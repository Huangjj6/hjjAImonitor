# Hot Monitor 技术方案

> 版本：v1.2 | 日期：2026-05-21

---

## 一、系统架构

```
┌─────────────────────────────────────────────────┐
│                 Frontend (React 18)              │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │  Bento   │ │ 关键词管理│ │   设置页面      │  │
│  │ Dashboard│ │          │ │                │  │
│  └──────────┘ └──────────┘ └────────────────┘  │
│        ↕ WebSocket        ↕ REST API            │
├─────────────────────────────────────────────────┤
│              Backend (Node.js + Express)         │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ AI验证服务│ │ 爬虫调度  │ │  通知服务       │  │
│  │(OpenRouter)│ │(node-cron)│ │(WS+Nodemailer) │  │
│  └──────────┘ └──────────┘ └────────────────┘  │
│                    ↕ sql.js                     │
└─────────────────────────────────────────────────┘
```

---

## 二、技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端 | React 18 + Vite + TailwindCSS | 快速开发、HMR、原子化 CSS |
| 后端 | Node.js + Express | 轻量、生态丰富 |
| 数据库 | SQLite (sql.js) | 纯 JS 实现，零依赖编译 |
| AI 服务 | OpenRouter API | 统一接入多模型，灵活切换 |
| 调度器 | node-cron | 轻量 cron 表达式 |
| 通知 | ws + Nodemailer | WebSocket 实时 + SMTP 邮件 |
| 爬虫 | axios + cheerio | HTTP 请求 + HTML/XML 解析 |

---

## 三、项目结构

```
hot-monitor/
├── backend/
│   ├── server.js              # Express 入口 + WebSocket
│   ├── config.js              # 环境配置聚合
│   ├── .env / .env.example    # API Key 配置
│   ├── middleware/
│   │   └── errorHandler.js    # 统一错误处理
│   ├── models/
│   │   └── database.js        # SQLite CRUD 封装（含防抖写盘）
│   ├── routes/
│   │   ├── keywords.js        # 关键词增删改查（含异步 AI 分类）
│   │   ├── hotspots.js        # 热点查询 + 演示数据 + 清空 + 通知历史
│   │   └── settings.js        # 系统设置 + 手动触发扫描
│   ├── services/
│   │   ├── aiService.js       # OpenRouter AI 验证 + 关键词分类 + 搜索词扩展
│   │   ├── crawlerService.js  # 多源爬虫（11 个信息源 + 降级策略）
│   │   ├── notifierService.js # WebSocket 推送 + 邮件（Nodemailer）
│   │   └── schedulerService.js# 定时调度（关键词并发、超时保护、AI 决策日志）
│   └── tests/
│       ├── ai_decisions.jsonl # AI 决策记录日志
│       └── evaluate.js        # 评估脚本
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx           # React 入口
│   │   ├── App.jsx            # 主布局 (2 Tab: 看板 + 管理)
│   │   ├── index.css          # Tailwind + 自定义样式
│   │   ├── lib/
│   │   │   └── utils.js       # 工具函数（cn, normalizeUrl 等）
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx  # Bento Grid 看板（统计横条 + 热点时间线）
│   │   │   └── SettingsPage.jsx # 设置页（独立路由，可被 ManagePage 集成）
│   │   ├── components/
│   │   │   ├── HotspotTimeline.jsx  # 热点卡片列表（筛选/排序/搜索/持久化）
│   │   │   ├── KeywordManager.jsx   # 关键词管理（CRUD + 分类标签）
│   │   │   ├── Navbar.jsx          # 导航栏（2 Tab: 雷达看板 + 管理）
│   │   │   ├── NotificationToast.jsx # 通知弹窗
│   │   │   ├── CategoryDropdown.jsx  # 分类选择下拉
│   │   │   └── ui/
│   │   │       ├── animated-background.jsx # 动态网格背景
│   │   │       └── glowing-effect.jsx      # 发光特效
│   │   └── hooks/
│   │       ├── useApi.js      # REST API 封装
│   │       └── useWebSocket.js# WebSocket 连接
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
├── agent-skills/
│   └── hot-monitor.md         # Agent Skills 定义
└── docs/
    ├── requirements.md        # 需求文档
    └── solution.md            # 本方案文档
```

---

## 四、数据库设计

```sql
-- 关键词
keywords (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'general',
  keyword_type TEXT DEFAULT 'topic',    -- person / organization / topic（AI 自动分类）
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
)

-- 热点
hotspots (
  id TEXT PRIMARY KEY,
  keyword_id TEXT REFERENCES keywords(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  summary TEXT,
  ai_score REAL DEFAULT 0,
  ai_reason TEXT,
  is_verified INTEGER DEFAULT 0,
  is_fake INTEGER DEFAULT 0,
  published_at TEXT,
  discovered_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (keyword_id) REFERENCES keywords(id)
)

-- 通知
notifications (
  id TEXT PRIMARY KEY,
  hotspot_id TEXT REFERENCES hotspots(id),
  type TEXT NOT NULL DEFAULT 'browser',
  recipient TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (hotspot_id) REFERENCES hotspots(id)
)

-- 设置
settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
)

-- 默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('crawler_interval', '10'),
  ('email_enabled', 'false'),
  ('twitter_enabled', 'true'),
  ('web_search_enabled', 'true');
```

---

## 五、API 设计

Base URL: `http://localhost:3001/api`

### 5.1 关键词

| 方法 | 路径 | 请求体 | 说明 |
|------|------|--------|------|
| GET | `/keywords` | — | 获取列表 |
| POST | `/keywords` | `{keyword, category?}` | 添加 |
| PUT | `/keywords/:id` | `{keyword?, category?, enabled?}` | 更新 |
| DELETE | `/keywords/:id` | — | 删除 |

### 5.2 热点

| 方法 | 路径 | 查询参数 / 请求体 | 说明 |
|------|------|-------------------|------|
| GET | `/hotspots` | `limit, offset, verified, keyword_id` | 列表 |
| GET | `/hotspots/:id` | — | 详情 |
| POST | `/hotspots/:id/mark-fake` | `{reason?}` | 标记虚假 |
| POST | `/hotspots/generate-demo` | — | 生成演示数据（需先有关键词） |
| DELETE | `/hotspots` | — | 清空所有热点和通知 |
| GET | `/hotspots/notifications/history` | `limit` | 通知历史记录 |

### 5.3 设置

| 方法 | 路径 | 请求体 | 说明 |
|------|------|--------|------|
| GET | `/settings` | — | 获取所有设置 |
| PUT | `/settings` | `{crawler_interval?, email_enabled?, twitter_enabled?, web_search_enabled?}` | 更新设置（更新爬取间隔时会自动重启调度器） |
| GET | `/settings/scheduler-status` | — | 调度器状态（含 running, isScanning, intervalMinutes 等） |
| POST | `/settings/trigger-scan` | — | 手动触发扫描（返回后异步执行） |

### 5.4 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 + API 状态 |
| GET | `/config-status` | API Key 配置状态 |

---

## 六、AI 验证流程

```
爬虫结果 → 去重(URL) → AI 验证 → 入库/过滤 → 通知
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                  score≥0.6  score<0.5  isFake
                  通知推送    静默入库   标记虚假
```

**AI Prompt 设计：**
- System：严格的信息相关性审核助手，只返回 JSON
- User：传入关键词 + 来源（含可信度标签）+ 标题 + 摘要
- 要求返回 JSON：`{contentSubject, matchMode, isRelevant, isFake, score, confidence, sentiment, entities, reason}`

**评分标准（4 档）：**
| 分数区间 | 含义 |
|----------|------|
| 0.0-0.3 | 无关（关键词仅在边栏/推荐位出现） |
| 0.3-0.5 | 弱相关（内容涉及相关领域但非焦点） |
| 0.5-0.7 | 直接相关（关键词是讨论对象之一） |
| 0.7-1.0 | 高度相关（关键词是核心主题，来源权威） |

**AI 输出字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `contentSubject` | string | 内容实际主题（20字内） |
| `matchMode` | enum | `exact_match / partial_match / tangential / unrelated` |
| `isRelevant` | boolean | 是否与关键词真正相关 |
| `isFake` | boolean | 是否为标题党/蹭热度/虚假 |
| `score` | 0-1 | 相关性分数 |
| `confidence` | 0-1 | AI 自身确信度 |
| `sentiment` | enum | `positive / negative / neutral` — 对关键词的情感倾向 |
| `entities` | string[] | 文中提及的其他关键实体 |
| `reason` | string | 判断理由（60字内） |

**综合评分公式：**
```
最终分 = AI原始分 × 来源可信度权重 + 标题命中加分(0.15) × 时间新颖度因子
```
- 来源可信度：T1=1.0, T2=0.95, T3=0.90, T4=0.85, T5=0.80
- 时间新颖度：14 天半衰期，最低 0.7 倍

**多层预过滤优化（P0）：**
4 层递进匹配，提高命中率同时避免无效 AI 调用：

| 层级 | 名称 | 说明 | 样例 |
|------|------|------|------|
| L1 | 精确子串 | 原始关键词直接匹配 | "GPT-5" → 标题含"GPT-5" |
| L2 | 分词匹配 | 按标点空格分词后匹配 | "GPT-5" → 标题含"GPT"和"5" |
| L3 | 规范化匹配 | 去掉标点空格后匹配 | "GPT-5" → 标题含"GPT5" |
| L4 | 同义映射 | 同义词/缩写/变体表匹配 | "AI" → 标题含"人工智能" |

全部未命中则返回 score=0.05、confidence=0.95，完全跳过 AI 调用。

**其他 AI 功能：**
- **关键词分类（classifyKeyword）** — 判断关键词类型：`person / organization / topic`
- **搜索词扩展（expandQuery）** — 生成中英文变体搜索词

**模型：** OpenRouter → `deepseek/deepseek-v3.2`（可配置）

---

## 七、爬虫设计

### 7.1 信息源

| 信息源 | 端点 | 方式 | 需要 Key | 降级策略 |
|--------|------|------|:--------:|----------|
| DuckDuckGo | `html.duckduckgo.com/html/` | HTML 解析 | ❌ | — |
| Bing News | `bing.com/search` | HTML 解析 | ❌ | — |
| Google News | `news.google.com/rss` | RSS 解析 | ❌ | — |
| 搜狗搜索 | `sogou.com/web` | HTML 解析 | ❌ | 多选择器兜底 |
| Twitter/X | `api.twitterapi.io/twitter/tweet/advanced_search` | REST API | ✅ | Key 未配置时静默跳过 |
| Bilibili | `api.bilibili.com/x/web-interface/search/type` | REST API | ❌ | API 失败 → HTML 降级 |
| HackerNews | `hn.algolia.com/api/v1/search` | REST API | ❌ | — |
| Gitee | `gitee.com/api/v5/search/repositories` | REST API | ❌ | — |
| Reddit | `reddit.com/search.json` | JSON feed | ❌ | — |
| 开源中国 | `oschina.net/search` | HTML 解析 | ❌ | — |
| GitHub | `api.github.com/search/repositories` | REST API | ❌ | 按 stars 排序 |

**特殊源行为：**
- **Bilibili 人物搜索** — 当 `keyword_type === 'person'` 时，额外搜索 UP 主空间及最新视频
- **组织/百科搜索** — 当 `keyword_type === 'organization'` 时，通过搜狗搜索间接获取百科信息
- **GitHub Trending** — 不按关键词搜索，直接拉取当日热门仓库榜单

### 7.2 源开关配置

`config.js` 中通过 `crawler.sources` 数组控制启用的源：

```js
sources: ['web', 'twitter', 'bilibili', 'hackernews', 'gitee', 'reddit', 'oschina', 'github']
// web = DuckDuckGo + Bing News + Google News + 搜狗搜索（4 个子源并行）
```

### 7.3 源级上限控制

`config.crawler.sourceMaxResults` 可对特定来源设置入库上限：

```js
sourceMaxResults: {
  '搜狗搜索': 3,   // 搜狗无发布时间，降低权重避免旧文章占太多
}
```

### 7.4 策略

- 关键词并发扫描（最多 3 个词并行，`Promise.allSettled`）
- 单源/单关键词异常不影响其他源/关键词
- URL 去重 + 来源自动修正（根据域名重写 source 字段）
- **标题相似度去重** — 3-gram Jaccard 相似度 >0.8 归组，每组仅保留来源可信度最高的结果进行 AI 验证
- 请求间延迟 2s（`config.crawler.requestDelay`）
- 按发布时间倒序排列（最新优先）

---

## 八、通知设计

### 8.1 浏览器通知

- WebSocket 连接 `ws://localhost:3001/ws`
- 自动重连（10s 间隔）
- 使用浏览器 Notification API
- 高相关度（score ≥ 0.6）才触发

### 8.2 邮件通知

- Nodemailer SMTP
- 可配置开关
- HTML 格式邮件，与前端风格一致

---

## 九、前端设计

### 9.1 设计风格

- **Dark Glassmorphism** — 暗黑玻璃拟态
- **Bento Grid** — 卡片式信息布局
- 配色：`#07070e` 背景 + 半透明白色卡片 + 微妙渐变
- 字体：Inter（正文）+ JetBrains Mono（数据）

### 9.2 页面结构

```
┌─────────────────────────────────────────────┐
│  🔍 HotMonitor        看板 | 关键词 | 设置   │
├─────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │ 已发现  │ │ 已确认  │ │ 已过滤  │ │ 监控  │ │
│  │   26   │ │   24   │ │   2    │ │  2   │ │
│  └────────┘ └────────┘ └────────┘ └──────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │         热点时间线（可滚动列表）          │ │
│  │  [全部] [真实] [虚假]                    │ │
│  │  ┌──────────────────────────────────┐   │ │
│  │  │ 𝕏 Twitter  · 3分钟前             │   │ │
│  │  │ DeepSeek V4 Pro 发布...   80%     │   │ │
│  │  │ 点击展开 → 摘要 + AI 分析          │   │ │
│  │  └──────────────────────────────────┘   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 十、配置项

| 配置 | 环境变量 / 位置 | 默认值 |
|------|------------------|--------|
| OpenRouter Key | `OPENROUTER_API_KEY` | — |
| OpenRouter Model | `OPENROUTER_MODEL` | `deepseek/deepseek-v3.2` |
| OpenRouter Base URL | `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| Twitter Key | `TWITTER_API_KEY` | — |
| Twitter Base | `TWITTER_API_BASE` | `https://api.twitterapi.io` |
| SMTP Host | `SMTP_HOST` | `smtp.gmail.com` |
| SMTP Port | `SMTP_PORT` | `587` |
| SMTP User | `SMTP_USER` | — |
| SMTP Pass | `SMTP_PASS` | — |
| Notification Email | `NOTIFICATION_EMAIL` | — |
| 爬取间隔 | `crawler_interval` (DB 设置) | 10 分钟 |
| 启用的信息源 | `config.crawler.sources` | `['web','twitter','bilibili','hackernews','gitee','reddit','oschina','github']` |
| 每源最大结果 | `config.crawler.maxResultsPerSource` | 8 |
| 源级上限 | `config.crawler.sourceMaxResults` | `{ '搜狗搜索': 3 }` |
| 请求间延迟 | `config.crawler.requestDelay` | 2000ms |
| 最大保留时间 | `config.crawler.maxAgeHours` | 0（不限） |
| 入库最低分 | `config.relevance.minSaveScore` | 0.4 |
| 通知触发分 | `config.relevance.notifyScore` | 0.6 |
| 预过滤开关 | `config.preFilter.enabled` | `true` |
| 预过滤未命中分 | `config.preFilter.scoreOnMiss` | 0.05 |
| 预过滤未命中确信度 | `config.preFilter.confidenceOnMiss` | 0.95 |
| 标题命中加分 | `config.relevance.titleKeywordBonus` | 0.15 |
| 搜索词扩展 | `config.queryExpansion.enabled` | `true` |
| 每源最多扩展词 | `config.queryExpansion.maxExpansionsPerSource` | 2 |
| 百科域名过滤 | `config.crawler.excludeDomains` | `[baike.baidu.com, wikipedia.org, ...]` |
| 百科标题过滤 | `config.crawler.excludeTitlePatterns` | `[百科, baike, 简介, 维基百科, ...]` |
