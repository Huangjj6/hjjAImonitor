# 信息源详解

## 概览

Hot Monitor 内置 7 大类信息源，覆盖全球中英文技术热点。每个源独立运行，单个源失败不影响其他源。

## 源列表

### 1. Web（综合网页搜索）
- **标识:** `web`
- **子源:** DuckDuckGo + Bing News + 搜狗搜索 + Google News RSS
- **接入方式:** HTML 爬虫 + RSS 解析
- **覆盖:** 全球中英文
- **限制:** 无 API Key 要求，但需注意请求频率
- **已知问题:**
  - DuckDuckGo 偶发验证码
  - Bing 中文结果可能被重定向
  - 搜狗搜索结果混杂广告
  - Google News RSS 部分被墙
- **容错:** 4 个子源独立执行，单个失败不影响其他

### 2. HackerNews
- **标识:** `hackernews`
- **接入方式:** Algolia Search API（JSON）
- **URL:** `https://hn.algolia.com/api/v1/search`
- **覆盖:** 全球科技/创业热点
- **限制:** 免费，无需 Key，速率限制 10 req/s
- **特点:** 结果质量高，社区讨论深度好
- **返回字段:** title, url, story_text, created_at, points, num_comments

### 3. Reddit
- **标识:** `reddit`
- **接入方式:** JSON feed（`.json` 后缀）
- **URL:** `https://www.reddit.com/search.json`
- **覆盖:** 国际社区讨论，全领域
- **限制:** 免费，无需 Key，速率限制 60 req/min
- **特点:** 覆盖面广，但信噪比偏低
- **返回字段:** title, permalink, selftext, created_utc, subreddit

### 4. GitHub
- **标识:** `github`
- **接入方式:** REST API v3
- **URL:** `https://api.github.com/search/repositories`
- **覆盖:** 全球开源仓库
- **限制:** 免费，无需 Key，速率限制 10 req/min（未认证）
- **特点:** 按 stars 排序，适合发现热门项目
- **返回字段:** full_name, html_url, description, language, updated_at, stargazers_count

### 5. Bilibili
- **标识:** `bilibili`
- **接入方式:** 官方搜索 API + HTML 降级
- **URL:** `https://api.bilibili.com/x/web-interface/search/type`
- **覆盖:** 中文视频社区
- **限制:** 免费，无需 Key
- **特殊功能:** 关键词类型为 `person` 时自动切换为用户搜索
- **降级策略:** API 返回空时自动使用 HTML 爬虫提取 `__INITIAL_STATE__`
- **返回字段:** title, bvid, description, pubdate, tag

### 6. Gitee
- **标识:** `gitee`
- **接入方式:** REST API v5
- **URL:** `https://gitee.com/api/v5/search/repositories`
- **覆盖:** 中文开源社区
- **限制:** 免费，无需 Key
- **特点:** 中文项目为主，补充 GitHub 的中文盲区
- **返回字段:** full_name, html_url, description, updated_at

### 7. 开源中国
- **标识:** `oschina`
- **接入方式:** HTML 爬虫
- **URL:** `https://www.oschina.net/search?scope=news`
- **覆盖:** 中文开发者新闻
- **限制:** 免费，无需 Key
- **已知问题:** HTML 结构偶有变化，解析可能失败
- **返回字段:** title, url, description, pub_date

## 源可用性检测

运行 `check` 命令可快速检测所有源当前状态：

```bash
python scripts/hot-monitor check
```

输出示例：
```
🔍 检测 7 个信息源可用性...
  ✅ 可用  Web
  ✅ 可用  HackerNews
  ⚠️ 无结果  Reddit
  ❌ HTTP 403  Gitee
```

## 新增信息源

在 `lib/sources/` 下新建文件，继承 `BaseSource`：

```python
from .base import BaseSource

class MyNewSource(BaseSource):
    name = 'mynew'
    display_name = 'MyNew'

    def search(self, keyword, limit=8, **kwargs):
        results = []
        # ... 实现搜索逻辑
        return results
```

然后在 `lib/sources/__init__.py` 的 `SOURCE_REGISTRY` 中注册：

```python
from .mynew import MyNewSource

SOURCE_REGISTRY = {
    # ...existing...
    'mynew': MyNewSource,
}
```
