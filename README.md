# 🔍 Hot Monitor — AI 热点雷达

AI 驱动的热点监控系统，自动发现、验证并推送热点信息。

## 功能

- 🔍 **多源采集** — 11 个信息源并行采集：DuckDuckGo、Bing News、Google News、搜狗搜索、Twitter/X、Bilibili（含人物搜索）、HackerNews、Gitee、Reddit、开源中国、GitHub Trending
- 🧠 **AI 验证** — 通过 OpenRouter 识别虚假/蹭热度内容，支持关键词分类与搜索词扩展
- 📡 **实时通知** — WebSocket 浏览器通知 + SMTP 邮件推送
- 📊 **雷达看板** — 赛博朋克风格可视化界面，支持筛选/排序/搜索/持久化
- 🤖 **Agent Skills** — 可被其他 AI Agent 调用

## 快速启动

```bash
# 1. 后端
cd backend
cp .env.example .env   # 编辑填入 OpenRouter API Key
npm install && npm start

# 2. 前端
cd frontend
npm install && npm run dev
```

打开 http://localhost:5173

## 配置

**必须配置：**
- [OpenRouter API Key](https://openrouter.ai/keys) — AI 验证功能

**可选配置：**
- [Twitter API Key](https://twitterapi.io/) — Twitter/X 信息源
- SMTP 设置 — 邮件通知

其余信息源（DuckDuckGo、Bing News、Google News、搜狗搜索、Bilibili、HackerNews、Gitee、Reddit、开源中国、GitHub）均为免费接入，无需任何配置。

## 信息源一览

| 信息源 | 接入方式 | 需要 Key | 说明 |
|--------|----------|:--------:|------|
| DuckDuckGo | HTML 爬虫 | ❌ | 基础 Web 搜索 |
| Bing News | HTML 爬虫 | ❌ | 备用新闻源 |
| Google News | RSS 解析 | ❌ | 全球新闻覆盖 |
| 搜狗搜索 | HTML 爬虫 | ❌ | 中文搜索强项 |
| Twitter/X | twitterapi.io API | ✅ | 实时推文搜索 |
| Bilibili | 官方 API + HTML 降级 | ❌ | 视频热点，含人物搜索 |
| HackerNews | Algolia API | ❌ | 全球科技热点 |
| Gitee | 官方 API | ❌ | 开源代码仓库 |
| Reddit | JSON feed | ❌ | 国际社区讨论 |
| 开源中国 | HTML 爬虫 | ❌ | 中文开发者新闻 |
| GitHub | 官方 API | ❌ | 热门仓库趋势 |

## 项目结构

```
hot-monitor/
├── backend/             # Node.js + Express 后端
│   ├── server.js        # 入口 + WebSocket
│   ├── config.js        # 聚合配置
│   ├── middleware/       # 错误处理
│   ├── models/          # SQLite 数据库
│   ├── routes/          # API 路由
│   ├── services/        # 核心服务（AI/爬虫/通知/调度）
│   └── tests/           # AI 决策日志与评估
├── frontend/            # React + Vite + TailwindCSS
│   └── src/
│       ├── components/  # UI 组件（含 ui/ 特效组件）
│       ├── pages/       # 页面（Dashboard + Settings）
│       ├── hooks/       # useApi, useWebSocket
│       └── lib/         # 工具函数
├── docs/                # 项目文档
│   ├── requirements.md
│   └── solution.md
└── agent-skills/        # Agent Skills 定义
    └── hot-monitor.md
```
