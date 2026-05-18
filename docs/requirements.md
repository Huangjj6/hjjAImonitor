# Hot Monitor 需求文档

> 版本：v1.1 | 日期：2026-05-18 | 作者：AI 编程工程师

---

## 一、项目背景

作为一名 AI 编程工程师，需要第一时间获取行业热点（如 AI 大模型更新），不能依赖人工手动搜索，而是要利用工具自动发现热点变化并及时收到通知。

这是一个轻量级工具类项目，采用敏捷开发方式，无需过多工程化。

---

## 二、核心功能

### 2.1 关键词监控

- 用户手动输入要监控的关键词（如"GPT-5"、"DeepSeek V4"）
- 系统每隔一段时间自动从多信息源搜索相关内容
- **利用 AI 识别假冒/蹭热度内容**，仅推送真正相关的热点
- 发现真实热点后第一时间发送通知

### 2.2 热点自动发现

- 自动搜集用户指定关键词范围内的热点
- 多信息源并行采集（Promise.allSettled），避免单一来源偏差
- 结果自动去重（URL 去重）
- 热点以时间线形式可视化展示（雷达图 + 列表）
- AI 对每条内容真实性评分（0~1），过滤低分项

### 2.3 通知推送

- 浏览器实时通知（WebSocket + Notification API）
- 邮件通知（SMTP，可选配置）
- 仅推送 AI 验证通过的高相关度内容（`ai_score >= 0.6`）

### 2.4 系统管理

- 关键词增删改查
- 信息源灵活配置（config.js 中 `sources` 数组）
- 手动触发扫描
- 调度器状态查看
- API Key 配置状态查看

---

## 三、产品形态

| 形态 | 说明 |
|------|------|
| **响应式 Web 页面** | 主要交互界面，支持桌面/移动端 |
| **Agent Skills** | 封装为标准技能文件，可被其他 AI Agent 调用 |

---

## 四、信息源要求

| 信息源 | 接入方式 | API Key | 说明 |
|--------|----------|:-------:|------|
| **DuckDuckGo** | HTML 爬虫（`html.duckduckgo.com`） | ❌ | 基础 Web 搜索，免费不被墙 |
| **Bing News** | RSS（`bing.com/news/search?format=rss`） | ❌ | 备用新闻源 |
| **Google News** | RSS（`news.google.com/rss`） | ❌ | 全球新闻覆盖 |
| **搜狗搜索** | HTML 爬虫（`sogou.com/web`） | ❌ | 中文搜索强项 |
| **Twitter/X** | twitterapi.io API | ✅ 需要 | 实时推文搜索 |
| **Bilibili** | 官方 API（`api.bilibili.com/x/web-interface/search/type`） | ❌ | 视频热点，中文社区 |
| **HackerNews** | Algolia API（`hn.algolia.com/api/v1`） | ❌ | 全球科技热点 |

> **配置方式：** 在 `config.js` 中通过 `crawler.sources` 数组控制启用的源：
> ```js
> sources: ['web', 'twitter', 'bilibili', 'hackernews']
> // web = DuckDuckGo + Bing News + 搜狗 + Google News
> ```
> 要求：同时从多个信息源并行采集（`Promise.allSettled`），URL 自动去重，避免单一来源偏差。注意请求频率控制。

---

## 五、AI 接入要求

- 使用 **OpenRouter** 统一接入 AI 服务
- AI 验证功能：
  - 判断内容是否与关键词真正相关
  - 识别虚假/标题党/蹭热度内容
  - 给每条内容打分（0~1）
- AI 模型可配置切换

---

## 六、技术约束

| 项目 | 选型 | 说明 |
|------|------|------|
| **后端框架** | Node.js + Express | RESTful API |
| **前端框架** | React 18 + Vite + TailwindCSS | SPA 单页应用 |
| **数据库** | SQLite（sql.js） | 轻量、零配置，无需安装 |
| **网页爬虫** | axios + cheerio | HTML 解析 + RSS 解析 |
| **定时调度** | node-cron | 间隔可配置 |
| **实时通信** | ws（WebSocket） | 通知推送 |
| **邮件通知** | nodemailer | SMTP 协议 |
| **AI 接入** | OpenRouter API | 统一多模型接口 |
| **部署方式** | 本地运行 | npm start |
| **API Key** | dotenv + .env | 留配置入口，用户自行填入 |
| **前端风格** | 独特、现代，非千篇一律 | 赛博朋克风雷达看板 |

---

## 七、开发优先级

1. **Web 页面** — 先完成，确保功能正常
2. **Agent Skills** — Web 版验证通过后再封装

---

## 八、非功能性需求

- 定时调度间隔可通过 API 动态配置（`PUT /api/settings`）
- 爬虫请求间有延迟控制（默认 2s），避免被封
- URL 去重，避免重复入库
- 系统状态可视化（`/api/config-status`、`/api/settings/scheduler-status`）
- 健康检查接口（`/api/health`）
- 各信息源独立容错，单个源失败不影响其他源
- 演示数据生成功能（`/api/hotspots/generate-demo`），便于快速体验
