# Hot Monitor — AI 热点监控技能

## 概述

Hot Monitor 是一个 AI 驱动的热点监控系统。它可以：
- 🔍 自动从 **11 个信息源**（DuckDuckGo、Bing News、Google News、搜狗搜索、Twitter/X、Bilibili、HackerNews、Gitee、Reddit、开源中国、GitHub Trending）并行采集热点
- 🧠 利用 OpenRouter AI 验证内容真实性，自动分类关键词（person/organization/topic），扩展搜索词
- 📡 实时推送通知（WebSocket 浏览器通知 + SMTP 邮件）
- 📊 提供赛博朋克风格的雷达可视化看板（含筛选/排序/搜索）

你可以通过 REST API 或直接操作来使用该技能。

---

## 快速开始

### 1. 启动服务

```bash
# 后端
cd backend
cp .env.example .env  # 编辑 .env 填入 API Key
npm install
npm start             # 运行在 http://localhost:3001

# 前端
cd frontend
npm install
npm run dev           # 运行在 http://localhost:5173
```

### 2. 配置 API Key（必须）

编辑 `backend/.env`：

```env
# OpenRouter AI（必须）- 用于内容验证
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx

# Twitter API（可选）- 从 twitterapi.io 获取
TWITTER_API_KEY=xxxxxxxxxxxxx

# 邮件通知（可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
NOTIFICATION_EMAIL=receive@example.com
```

---

## API 参考

Base URL: `http://localhost:3001/api`

### 关键词管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/keywords` | 获取所有关键词 |
| `POST` | `/keywords` | 添加关键词 `{keyword, category?}` |
| `PUT` | `/keywords/:id` | 更新关键词 `{keyword?, category?, enabled?}` |
| `DELETE` | `/keywords/:id` | 删除关键词 |

#### 示例：添加监控关键词

```bash
curl -X POST http://localhost:3001/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"keyword": "GPT-5 发布", "category": "AI"}'
```

### 热点查询

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/hotspots?limit=50&offset=0&verified=true` | 获取热点列表 |
| `GET` | `/hotspots?keyword_id=xxx` | 按关键词筛选 |
| `GET` | `/hotspots/:id` | 获取单条热点 |
| `POST` | `/hotspots/:id/mark-fake` | 标记为虚假 `{reason?}` |
| `POST` | `/hotspots/generate-demo` | 生成演示数据（需先有关键词） |
| `DELETE` | `/hotspots` | 清空所有热点 |
| `GET` | `/hotspots/notifications/history?limit=30` | 通知历史记录 |

#### 示例：获取热点

```bash
curl http://localhost:3001/api/hotspots?limit=10&verified=true
```

### 设置与操作

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/settings` | 获取所有设置 |
| `PUT` | `/settings` | 更新设置 `{crawler_interval?, email_enabled?, twitter_enabled?, web_search_enabled?}` |
| `POST` | `/settings/trigger-scan` | 手动触发扫描（异步执行） |
| `GET` | `/settings/scheduler-status` | 调度器状态（含 running, isScanning, intervalMinutes） |
| `GET` | `/config-status` | API Key 配置状态 |
| `GET` | `/health` | 健康检查 |

---

## AI 验证逻辑

Hot Monitor 利用 OpenRouter AI 进行多级验证：

1. **多层预过滤** — 4 层递进匹配（精确子串 → 分词 → 规范化 → 同义映射），全部未命中则跳过 AI 调用（score=0.05）。内置同义表覆盖 AI/编程/框架/公司等常见领域
2. **相关性判断** — 内容是否与监控关键词真正相关（排除关键词蹭热度）
3. **真实性判断** — 识别标题党、谣言、广告软文等虚假内容
4. **主题提取** — 识别内容实际主题（contentSubject）与匹配模式（matchMode）
5. **情感分析** — 判断对关键词的情感倾向（sentiment: positive/negative/neutral）
6. **实体提取** — 提取文中其他关键实体（entities）
7. **置信度评估** — AI 对自身判断的确信度评分（confidence）
8. **综合评分** — AI 原始分 × 来源可信度权重 + 标题命中加分 × 时间新颖度因子

**AI 返回字段：**
| 字段 | 说明 |
|------|------|
| `contentSubject` | 内容实际主题 |
| `matchMode` | 匹配模式（exact/partial/tangential/unrelated） |
| `isRelevant` | 是否真正相关 |
| `isFake` | 是否虚假/蹭热度 |
| `score` | 相关性评分（0-1） |
| `confidence` | AI 确信度（0-1） |
| `sentiment` | 情感倾向（positive/negative/neutral） |
| `entities` | 关联实体列表 |
| `reason` | 判断理由 |

只有 `isRelevant=true && isFake=false && score>=0.6` 的热点才会触发通知。

---

## 信息源

系统同时从以下信息源采集数据：

| 信息源 | 实现方式 | 需要配置 | 说明 |
|--------|----------|:--------:|------|
| DuckDuckGo | HTML 爬虫 | 无 | 基础 Web 搜索 |
| Bing News | HTML 爬虫 | 无 | 备用新闻源（RSS 已屏蔽改用 HTML） |
| Google News | RSS 解析 | 无 | 全球新闻覆盖 |
| 搜狗搜索 | HTML 爬虫 | 无 | 中文搜索强项 |
| Twitter/X | twitterapi.io API | `TWITTER_API_KEY` | 实时推文搜索 |
| Bilibili | 官方 API + HTML 降级 | 无 | 视频热点，含人物搜索 |
| HackerNews | Algolia API | 无 | 全球科技热点 |
| Gitee | 官方 API | 无 | 开源代码仓库 |
| Reddit | JSON feed | 无 | 国际社区讨论 |
| 开源中国 | HTML 爬虫 | 无 | 中文开发者新闻 |
| GitHub | 官方 API | 无 | 热门仓库趋势 |

所有信息源并行采集（`Promise.allSettled`），按 URL 去重 + 来源自动修正。单个源失败不影响其他源。
支持标题相似度去重（3-gram Jaccard），以及按来源设置入库上限。

---

## WebSocket 实时通知

连接 `ws://localhost:3001/ws`，接收实时热点推送：

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'notification') {
    console.log('新热点:', msg.data.title, msg.data.score);
  }
};
```

---

## 调度机制

- 默认每 10 分钟自动扫描一次
- 可在设置页调整间隔（5/10/15/30/60 分钟）
- 支持手动触发扫描
- 最多同时扫描 3 个关键词（关键词并发控制）
- 单次扫描最长 5 分钟，超时自动重置
- AI 决策记录到 `backend/tests/ai_decisions.jsonl`

---

## 为其他 AI Agent 使用

其他 AI Agent 可通过以下方式使用 Hot Monitor：

### 方式一：API 调用

```javascript
// 添加监控关键词
await fetch('http://localhost:3001/api/keywords', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ keyword: 'OpenAI Sora', category: 'AI' })
});

// 获取最新热点
const res = await fetch('http://localhost:3001/api/hotspots?verified=true&limit=10');
const { data } = await res.json();
// data 中包含 title, url, source, summary, ai_score, ai_reason 等
```

### 方式二：直接操作数据库

```bash
sqlite3 backend/hot_monitor.db "SELECT * FROM hotspots WHERE is_fake=0 ORDER BY ai_score DESC LIMIT 10;"
```

### 方式三：生成报告

```javascript
// 获取所有已验证热点
const res = await fetch('http://localhost:3001/api/hotspots?verified=true');
const { data } = await res.json();

// 按来源分组统计
const bySource = data.reduce((acc, h) => {
  acc[h.source] = (acc[h.source] || 0) + 1;
  return acc;
}, {});

console.log('热点来源分布:', bySource);
console.log('平均相关度:', (data.reduce((s, h) => s + h.ai_score, 0) / data.length * 100).toFixed(1) + '%');
```

---

## 数据库结构

```
keywords (id, keyword, category, enabled, created_at, updated_at)
hotspots (id, keyword_id, title, url, source, summary, ai_score, ai_reason, is_verified, is_fake, published_at, discovered_at)
notifications (id, hotspot_id, type, recipient, status, sent_at)
settings (key, value, updated_at)
```

---

## 技术栈

- **前端**: React 18 + Vite + TailwindCSS
- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **AI**: OpenRouter API
- **调度**: node-cron
- **通知**: WebSocket + Nodemailer
