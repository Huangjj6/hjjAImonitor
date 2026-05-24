---
name: hot-monitor
description: AI 热点监控技能 — 从 7 大类信息源（Web综合/DuckDuckGo/Bing/搜狗/GoogleNews、HackerNews、Reddit、GitHub、Bilibili、Gitee、开源中国）自动采集热点，由 AI Agent 自身完成内容分析和真实性验证。当你需要监控技术热点、追踪行业趋势、搜索最新动态、或建立关键词监控时使用此技能。用户提到"热点"、"监控"、"追踪"、"热搜"、"趋势"、"扫描"、"最新消息"、"有什么新闻"时都应触发此技能。零依赖（Python 3.8+ 标准库），开箱即用。
---

# Hot Monitor — AI 热点监控

## 概述

本技能让你成为热点雷达。它包含一个**零依赖的 Python CLI 工具**。

### ⚠️ 重要：本项目不使用外部 AI API

- 原始项目的后端通过 OpenRouter 调用 DeepSeek 做 AI 验证
- **本 Skill 版本已完全移除 AI API 依赖**
- CLI 脚本只做数据采集（爬虫、去重、存储）— **不做任何 AI 推理**
- **所有内容分析（相关性、真实性、评分）由你（AI Agent）亲自完成**

### 分工原则

| 角色 | 职责 |
|------|------|
| **CLI 脚本** (`hot-monitor`) | 从 7 类信息源爬取原始数据、URL 去重、标题相似度去重、JSON 存储 |
| **你（AI Agent）** | 分析内容相关性、识别虚假/蹭热度内容、评分（0~1）、生成自然语言总结 |

## 快速开始

```bash
# Python 3.8+，零安装零配置
python skills/hot-monitor/scripts/hot-monitor <command> [options]

# 添加监控关键词
python skills/hot-monitor/scripts/hot-monitor add "GPT-5" --category AI

# 全网扫描（输出 JSON 供你分析）
python skills/hot-monitor/scripts/hot-monitor scan "GPT-5"

# 输出人类可读的 Markdown 表格
python skills/hot-monitor/scripts/hot-monitor scan "GPT-5" --format table

# 指定源 + 保存
python skills/hot-monitor/scripts/hot-monitor scan "GPT-5" --sources hackernews,github --limit 5 --save

# 查看已存储的热点
python skills/hot-monitor/scripts/hot-monitor hotspots --limit 10

# 检测信息源可用性
python skills/hot-monitor/scripts/hot-monitor check
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `add <kw> [--category <cat>]` | 添加关键词，自动识别类型(person/organization/topic) |
| `list [--enabled] [--category]` | 列出关键词 |
| `remove <id\|kw>` | 删除关键词 |
| `scan [kw] [--sources X] [--limit N] [--format json\|table] [--save]` | 采集热点 |
| `hotspots [--limit N] [--format json\|table]` | 查看已存储热点 |
| `demo` | 生成 7 条演示数据 |
| `status` | 查看统计信息 |
| `check` | 检测信息源可用性 |

## 工作流程

### 场景 1：监控话题
```
用户: "帮我看看最近 GPT-5 有什么新消息"
你的步骤:
1. python scripts/hot-monitor scan "GPT-5"
2. 分析输出的 JSON（参考 references/analysis-guide.md）
3. 用 Markdown 报告给用户
```

### 场景 2：添加长效监控
```
1. python scripts/hot-monitor add "关键词" --category AI
2. python scripts/hot-monitor scan
3. 分析 → 报告
```

### 场景 3：查看已有热点
```
1. python scripts/hot-monitor hotspots --limit 20
2. 整理呈现
```

## 参考文档（需要时读取）

| 文档 | 何时读取 |
|------|---------|
| `references/sources.md` | 需要了解信息源详情或新增源 |
| `references/analysis-guide.md` | 分析扫描结果时的评分公式、虚假识别、输出模板 |
| `references/troubleshooting.md` | 遇到错误、无结果、被限流等情况 |

## 环境要求

- **Python 3.8+**（标准库，零 pip install）
- 零配置、零 API Key
- 自动去重 + UA 轮换 + 请求节流
4. **标题去重:** 相似度 >0.8 的标题自动合并
5. **容错设计:** 单个源失败不影响其他源
6. **数据持久化:** 使用 `--save` 参数可将结果保存到 JSON 文件，下次查询 `hotspots` 时可见
