# -*- coding: utf-8 -*-
"""
工具函数 — UA 轮换、HTML 清理、时间解析、URL 处理、输入安全
零外部依赖，仅用 Python 3.8+ 标准库。
"""

import re
import html as _html
import random
import shlex
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

# ─── UA 轮换池 ───

_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:127.0) Gecko/20100101 Firefox/127.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
]

def random_ua():
    """返回一个随机 User-Agent"""
    return random.choice(_USER_AGENTS)

# ─── 通用请求头 ───

def default_headers(extra=None):
    """构建默认请求头，可合并额外 header"""
    h = {
        'User-Agent': random_ua(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    if extra:
        h.update(extra)
    return h

# ─── HTML 清理 ───

_HTML_TAG_RE = re.compile(r'<[^>]+>')
_HTML_ENTITY_MAP = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#x27;': "'", '&ensp;': ' ', '&emsp;': ' ', '&nbsp;': ' ',
}

def clean_html(text):
    """清理 HTML 标签和常见实体"""
    if not text:
        return ''
    # 先解码标准 HTML 实体
    text = _html.unescape(text)
    # 再补刀常见未覆盖实体
    for entity, char in _HTML_ENTITY_MAP.items():
        text = text.replace(entity, char)
    # 去除剩余 HTML 标签
    text = _HTML_TAG_RE.sub('', text)
    # 合并空白
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def truncate(text, max_len=300):
    """安全截断文本"""
    if not text:
        return ''
    return text[:max_len]

# ─── 时间解析 ───

_RELATIVE_TIME_RE = re.compile(
    r'(?P<num>\d+)\s*'
    r'(分钟前|小时前|天前|周前|月前|'
    r'min(?:ute)?s?\s*ago|hour(?:s)?\s*ago|day(?:s)?\s*ago|week(?:s)?\s*ago|month(?:s)?\s*ago)',
    re.IGNORECASE
)

_TIME_UNITS = {
    '分钟前': 'minutes', '小时前': 'hours', '天前': 'days', '周前': 'weeks', '月前': 'months',
    'minute': 'minutes', 'minutes': 'minutes', 'min': 'minutes',
    'hour': 'hours', 'hours': 'hours',
    'day': 'days', 'days': 'days',
    'week': 'weeks', 'weeks': 'weeks',
    'month': 'months', 'months': 'months',
}

def parse_relative_date(text):
    """从自然语言时间文本推断 ISO 时间"""
    if not text:
        return None
    text = text.strip().lower()
    now = datetime.now(timezone.utc)

    m = _RELATIVE_TIME_RE.match(text)
    if m:
        num = int(m.group('num'))
        unit = m.group(2).lower()
        unit_key = _TIME_UNITS.get(unit, 'days')
        kwargs = {unit_key: num}
        dt = now - timedelta(**kwargs)
        return dt.isoformat()

    # 中英文今天/昨天
    today_kw = ['今天', 'today']
    yesterday_kw = ['昨天', 'yesterday']
    for kw in today_kw:
        if kw in text:
            return now.isoformat()
    for kw in yesterday_kw:
        if kw in text:
            return (now - timedelta(days=1)).isoformat()
    return None

def parse_iso_date(text):
    """尝试解析 ISO 或常见日期格式"""
    if not text:
        return None
    text = clean_html(text).strip()
    # 已经是 ISO 格式
    try:
        return datetime.fromisoformat(text).isoformat()
    except (ValueError, TypeError):
        pass
    # RFC 2822 (RSS pubDate)
    from email.utils import parsedate_to_datetime
    try:
        return parsedate_to_datetime(text).isoformat()
    except (ValueError, TypeError):
        pass
    # 相对时间
    rel = parse_relative_date(text)
    if rel:
        return rel
    return None

# ─── URL 处理 ───

def normalize_url(raw_url):
    """URL 规范化：解密重定向、补全协议"""
    if not raw_url:
        return ''
    url = raw_url.strip()
    # DuckDuckGo 重定向
    if url.startswith('/l/?uddg='):
        from urllib.parse import unquote
        try:
            return unquote(url.replace('/l/?uddg=', ''))
        except Exception:
            return ''
    # 搜狗等相对路径
    if url.startswith('/') and not url.startswith('//'):
        return ''
    if not (url.startswith('http://') or url.startswith('https://')):
        return ''
    return url

def extract_domain(url):
    """从 URL 提取域名"""
    try:
        return urlparse(url).hostname or url
    except Exception:
        return url

def is_excluded_domain(url, exclude_domains):
    """检查 URL 是否命中排除域名列表"""
    host = extract_domain(url).lower()
    return any(d.lower() in host for d in exclude_domains)

# ─── 输入安全校验 ───

def sanitize_input(value):
    """对用户输入做基础安全清理，移除潜在危险字符"""
    if not value:
        return ''
    # 移除可能用于命令注入的字符
    dangerous = ['\x00', '\r', '\n']
    for c in dangerous:
        value = value.replace(c, '')
    return value.strip()

def shell_quote(value):
    """安全引用字符串，防止命令注入"""
    return shlex.quote(value)

# ─── 关键词类型推测 ───

_PERSON_PATTERNS = [
    re.compile(r'^(Elon|Sam|Jeff|Bill|Satya|Tim|Mark|Sundar|Jack|Demis|Ilya|Andrej|Yann|Geoffrey)\s', re.I),
    re.compile(r'^[\u4e00-\u9fff]{2,4}$'),
    re.compile(r'马斯克|奥特曼|扎克伯格|黄仁勋|李开复|李飞飞|吴恩达|沈向洋|陆奇|周鸿祎|雷军|任正非|马化腾|梁文峰'),
]

_ORG_PATTERNS = [
    re.compile(r'^(OpenAI|Google|Microsoft|Meta|Apple|Amazon|Tesla|Anthropic|DeepMind|百度|阿里|腾讯|字节|华为|小米)', re.I),
    re.compile(r'公司|大学|研究院|实验室|Inc|Corp|Ltd'),
]

def guess_keyword_type(keyword):
    """简单规则推测关键词类型：person / organization / topic"""
    for p in _PERSON_PATTERNS:
        if p.search(keyword):
            return 'person'
    for p in _ORG_PATTERNS:
        if p.search(keyword):
            return 'organization'
    return 'topic'
