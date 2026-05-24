# 故障排查

## 常见问题

### 1. "没有已启用的关键词"

**现象:** `scan` 命令返回此错误。

**解决:**
```bash
# 先添加关键词
python scripts/hot-monitor add "GPT-5" --category AI

# 确认已添加
python scripts/hot-monitor list

# 再次扫描
python scripts/hot-monitor scan
```

### 2. 所有源返回 0 结果

**可能原因与排查:**

1. **网络不通** — 确认能访问外网
   ```bash
   curl -I https://www.google.com
   ```

2. **被限流/封禁** — 短时间内请求过多
   - 等待 5-10 分钟后重试
   - 减少 `--limit` 参数值
   - 减少 `--sources` 数量

3. **关键词太生僻** — 换一个常见词测试
   ```bash
   python scripts/hot-monitor scan "TypeScript" --sources hackernews
   ```

### 3. HTTP 403 / 429 错误

**说明:** 被目标网站限流或拒绝访问。

**解决:**
- 脚本已内置指数退避重试，等待即可
- 减少并发源数量：`--sources hackernews`
- 降低每源结果数：`--limit 3`
- 手动等待 5-10 分钟

### 4. HTML 解析失败（返回 0 但无报错）

**说明:** 网站 HTML 结构变更，正则匹配失效。

**影响源:** DuckDuckGo、Bing、搜狗、开源中国

**临时方案:** 换用 JSON API 源
```bash
python scripts/hot-monitor scan "关键词" --sources hackernews,reddit,github,gitee
```

**永久方案:** 更新对应源的 `lib/sources/web.py` 或 `lib/sources/oschina.py` 中的正则表达式。

### 5. 中文搜索结果质量差

**原因:** 部分国际源（HackerNews、Reddit）以英文为主。

**优化:**
```bash
# 中文关键词优先用这些源
python scripts/hot-monitor scan "大模型" --sources web,bilibili,gitee,oschina
```

### 6. Python 版本不兼容

**要求:** Python 3.8+

**检查:**
```bash
python3 --version  # 或 python --version
```

**安装:** https://www.python.org/downloads/

### 7. 数据文件损坏

**现象:** JSON 解析错误。

**解决:**
- 删除 `skills/hot-monitor/data/` 目录（数据会丢失）
- 重新添加关键词和扫描
```bash
rm -rf skills/hot-monitor/data/
python scripts/hot-monitor add "GPT-5"
python scripts/hot-monitor scan
```

### 8. Windows 终端乱码

**解决:**
- 使用 Windows Terminal（推荐）
- 或在命令前加 `chcp 65001` 切换到 UTF-8
```powershell
chcp 65001
python scripts/hot-monitor scan "GPT-5"
```

## 诊断命令

```bash
# 检测所有信息源可用性
python scripts/hot-monitor check

# 查看当前配置和统计
python scripts/hot-monitor status

# 用最小范围快速验证网络
python scripts/hot-monitor scan "test" --sources hackernews --limit 1

# 生成演示数据测试完整流程
python scripts/hot-monitor demo
python scripts/hot-monitor hotspots --format table
```
