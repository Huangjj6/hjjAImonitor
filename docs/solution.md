# Hot Monitor 技术方案

> 版本：v1.1 | 日期：2026-05-18

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
│   ├── models/
│   │   └── database.js        # SQLite CRUD 封装
│   ├── routes/
│   │   ├── keywords.js        # 关键词增删改查
│   │   ├── hotspots.js        # 热点查询 + 演示数据
│   │   └── settings.js        # 系统设置 + 手动扫描
│   ├── services/
│   │   ├── aiService.js       # OpenRouter AI 验证
│   │   ├── crawlerService.js  # 多源爬虫
│   │   ├── notifierService.js # WebSocket + 邮件
│   │   └── schedulerService.js# 定时调度
│   └── middleware/
│       └── errorHandler.js    # 统一错误处理
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx           # React 入口
│   │   ├── App.jsx            # 主布局 (3 Tab)
│   │   ├── index.css          # Tailwind + 自定义样式
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx  # Bento Grid 看板
│   │   │   └── SettingsPage.jsx
│   │   ├── components/
│   │   │   ├── HotspotTimeline.jsx  # 热点卡片列表
│   │   │   ├── KeywordManager.jsx   # 关键词管理
│   │   │   ├── Navbar.jsx          # 导航栏
│   │   │   └── NotificationToast.jsx # 通知弹窗
│   │   └── hooks/
│   │       ├── useApi.js      # REST API 封装
│   │       └── useWebSocket.js# WebSocket 连接
│   ├── tailwind.config.js
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
  enabled INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
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
  discovered_at TEXT
)

-- 通知
notifications (
  id TEXT PRIMARY KEY,
  hotspot_id TEXT REFERENCES hotspots(id),
  type TEXT NOT NULL DEFAULT 'browser',
  recipient TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TEXT
)

-- 设置
settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT
)
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

| 方法 | 路径 | 查询参数 | 说明 |
|------|------|----------|------|
| GET | `/hotspots` | `limit, offset, verified, keyword_id` | 列表 |
| GET | `/hotspots/:id` | — | 详情 |
| POST | `/hotspots/:id/mark-fake` | `{reason?}` | 标记虚假 |

### 5.3 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/settings` | 获取所有设置 |
| PUT | `/settings` | 更新设置 |
| GET | `/settings/scheduler-status` | 调度器状态 |
| POST | `/settings/trigger-scan` | 手动触发扫描 |

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
- System：严格的信息验证助手
- User：传入关键词 + 标题 + 摘要 + 来源
- 要求返回 JSON：`{isRelevant, isFake, score, reason}`

**模型：** OpenRouter → `deepseek/deepseek-v3.2`

---

## 七、爬虫设计

### 7.1 信息源

| 信息源 | 端点 | 方式 | 需要 Key |
|--------|------|------|:--------:|
| DuckDuckGo | `html.duckduckgo.com/html/` | HTML 解析 | ❌ |
| Bing News | `bing.com/news/search?format=rss` | RSS 解析 | ❌ |
| Google News | `news.google.com/rss` | RSS 解析 | ❌ |
| 搜狗搜索 | `sogou.com/web` | HTML 解析 | ❌ |
| Twitter/X | `api.twitterapi.io/twitter/tweet/advanced_search` | REST API | ✅ |
| Bilibili | `api.bilibili.com/x/web-interface/search/type` | REST API | ❌ |
| HackerNews | `hn.algolia.com/api/v1/search` | REST API | ❌ |

### 7.2 源开关配置

`config.js` 中通过 `crawler.sources` 数组控制启用的源：

```js
sources: ['web', 'twitter', 'bilibili', 'hackernews']
// web = DuckDuckGo + Bing News + Google News + 搜狗搜索
```

### 7.3 策略

- 并行请求所有信息源（`Promise.allSettled`）
- 单源异常不影响其他源
- URL 去重
- 请求间延迟 2s（`config.crawler.requestDelay`）

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
| Twitter Key | `TWITTER_API_KEY` | — |
| Twitter Base | `TWITTER_API_BASE` | `https://api.twitterapi.io` |
| SMTP Host | `SMTP_HOST` | `smtp.gmail.com` |
| 爬取间隔 | `crawler_interval` (DB 设置) | 10 分钟 |
| 启用的信息源 | `config.crawler.sources` | `['web','twitter','bilibili','hackernews']` |
| 每源最大结果 | `config.crawler.maxResultsPerSource` | 5 |
| 请求间延迟 | `config.crawler.requestDelay` | 2000ms |
