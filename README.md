# 🔍 Hot Monitor — AI 热点雷达

AI 驱动的热点监控系统，自动发现、验证并推送热点信息。

## 功能

- 🔍 **多源采集** — DuckDuckGo、Bing News、Google News、搜狗搜索、HackerNews、Bilibili、Twitter/X 并行采集
- 🧠 **AI 验证** — 通过 OpenRouter 识别虚假/蹭热度内容
- 📡 **实时通知** — 浏览器通知 + 邮件推送
- 📊 **雷达看板** — 赛博朋克风格可视化界面
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

其余信息源（DuckDuckGo、Bing News、Google News、搜狗搜索、Bilibili、HackerNews）均为免费接入，无需任何配置。

## 项目结构

```
hot-monitor/
├── backend/           # Node.js + Express 后端
│   ├── server.js      # 入口
│   ├── config.js      # 配置
│   ├── models/        # 数据库
│   ├── routes/        # API 路由
│   └── services/      # 核心服务
├── frontend/          # React + Vite 前端
│   └── src/
│       ├── components/ # UI 组件
│       ├── pages/      # 页面
│       └── hooks/      # 自定义 Hooks
├── docs/              # 项目文档
│   ├── requirements.md
│   └── solution.md
└── agent-skills/      # Agent Skills 定义
    └── hot-monitor.md
```
