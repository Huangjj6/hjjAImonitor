# -*- coding: utf-8 -*-
"""
综合网页搜索源 — DuckDuckGo + Bing + 搜狗 + Google News RSS
"""

import re
import urllib.parse
from html.parser import HTMLParser
from .base import BaseSource
from utils import clean_html, truncate, parse_relative_date, parse_iso_date, normalize_url


# ─── 搜狗日期提取 ───
def _extract_sogou_date(text):
    """从搜狗搜索结果文本中解析日期"""
    if not text:
        return None
    # "2025-03-15" 或 "2025年3月15日"
    m = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', text)
    if m:
        try:
            from datetime import datetime
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
        except:
            pass
    m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', text)
    if m:
        try:
            from datetime import datetime
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).isoformat()
        except:
            pass
    # "3天前"、"5小时前"
    return parse_relative_date(text)

# ─── HTML 结构化提取器 ───

class _ResultExtractor(HTMLParser):
    """从 HTML 中提取 class=xxx 的 div 并收集其内部文本"""

    def __init__(self, target_class, inner_tag='a', inner_attr='href'):
        super().__init__()
        self.target_class = target_class
        self.inner_tag = inner_tag
        self.inner_attr = inner_attr
        self.results = []
        self._current = None
        self._depth = 0
        self._text_parts = []
        self._in_target = False
        self._collecting_text = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get('class', '')
        if self.target_class in cls.split():
            self._in_target = True
            self._depth = 0
            self._current = {'title': '', 'url': '', 'snippet': ''}
            self._text_parts = []
            self._collecting_text = True
        elif self._in_target:
            self._depth += 1
            if tag == self.inner_tag and self._current is not None:
                href = attrs_dict.get(self.inner_attr, '')
                if href and not self._current['url']:
                    self._current['url'] = href

    def handle_endtag(self, tag):
        if self._in_target:
            if self._depth > 0:
                self._depth -= 1
            else:
                self._in_target = False
                self._collecting_text = False
                if self._current:
                    self._current['snippet'] = ' '.join(self._text_parts).strip()
                    self.results.append(self._current)
                self._current = None

    def handle_data(self, data):
        if self._collecting_text and self._current is not None:
            if not self._current['title']:
                self._current['title'] = data.strip()
            else:
                self._text_parts.append(data.strip())


class WebSource(BaseSource):
    """综合搜索：DuckDuckGo + Bing News + 搜狗 + Google News"""

    name = 'web'
    display_name = 'Web'

    def search(self, keyword, limit=8, **kwargs):
        results = []
        # 并行搜索四个子源（顺序执行以控制并发）
        results.extend(self._search_ddg(keyword, limit))
        results.extend(self._search_bing(keyword, limit))
        results.extend(self._search_sogou(keyword, limit))
        results.extend(self._search_google_news(keyword, limit))
        return results

    # ─── DuckDuckGo ───

    def _search_ddg(self, keyword, limit=8):
        results = []
        query = urllib.parse.quote(f'{keyword} news')
        ok, text, _ = self.fetch(f'https://html.duckduckgo.com/html/?q={query}', timeout=10)
        if not ok or not text:
            return results

        # 用正则提取 result__body 块（比 HTMLParser 更可靠地跨越嵌套结构）
        blocks = re.split(r'class="result__body"', text, flags=re.I)[1:]
        for block in blocks[:limit]:
            # 标题 + 链接
            tm = re.search(r'class="result__title"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', block, re.I)
            if not tm:
                continue
            raw_link, raw_title = tm.group(1), clean_html(tm.group(2))
            url = normalize_url(raw_link)
            if not raw_title or not url:
                continue

            # 摘要
            sm = re.search(r'class="result__snippet"[^>]*>([\s\S]*?)</td>', block, re.I)
            summary = clean_html(sm.group(1)) if sm else ''

            # 时间
            tim = re.search(r'class="result__timestamp"[^>]*>([\s\S]*?)</span>', block, re.I)
            pub_at = parse_relative_date(clean_html(tim.group(1))) if tim else None

            results.append({
                'title': raw_title, 'url': url, 'source': 'DuckDuckGo',
                'summary': truncate(summary), 'published_at': pub_at,
            })
        self._log(f'DuckDuckGo: {len(results)} results')
        return results

    # ─── Bing News ───

    def _search_bing(self, keyword, limit=8):
        results = []
        query = urllib.parse.quote(f'{keyword} news')
        ok, text, _ = self.fetch(
            f'https://www.bing.com/search?q={query}&setlang=en-US',
            timeout=10,
            headers={'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://www.bing.com/'}
        )
        if not ok or not text:
            return results

        blocks = re.split(r'class="b_algo"', text, flags=re.I)[1:]
        for block in blocks[:limit]:
            tm = re.search(r'<h2[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', block, re.I)
            if not tm:
                continue
            url, raw_title = tm.group(1), clean_html(tm.group(2))
            if not raw_title or not url.startswith('http'):
                continue

            sm = re.search(r'class="b_caption"[^>]*>([\s\S]*?)(?=class="b_attribution|<li\s|$)', block, re.I)
            if not sm:
                sm = re.search(r'<p[^>]*>([\s\S]*?)</p>', block, re.I)
            summary = clean_html(sm.group(1)) if sm else ''

            dm = re.search(r'class="news_dt"[^>]*>([\s\S]*?)</span>', block, re.I)
            if not dm:
                dm = re.search(r'class="b_secondaryText"[^>]*>([^<]+)', block, re.I)
            pub_at = parse_relative_date(clean_html(dm.group(1))) if dm else None

            results.append({
                'title': raw_title, 'url': url, 'source': 'Bing News',
                'summary': truncate(summary), 'published_at': pub_at,
            })
        self._log(f'Bing News: {len(results)} results')
        return results

    # ─── 搜狗搜索 ───

    def _search_sogou(self, keyword, limit=8):
        results = []
        query = urllib.parse.quote(keyword)
        ok, text, _ = self.fetch(f'https://www.sogou.com/web?query={query}', timeout=15)
        if not ok or not text:
            return results

        # 多选择器覆盖不同页面结构
        blocks = re.split(r'class="(?:rb|vrwrap|vr_title|result|res-item)"', text, flags=re.I)[1:]
        if not blocks or len(blocks) < 2:
            # 备用：直接找所有带链接的 h3/a
            matches = re.finditer(r'<h3[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', text, re.I)
            for m in matches:
                if len(results) >= limit:
                    break
                raw_link, raw_title = m.group(1), clean_html(m.group(2))
                url = raw_link if raw_link.startswith('http') else f'https://www.sogou.com{raw_link}'
                if raw_title and url.startswith('http') and 'javascript' not in raw_link:
                    results.append({
                        'title': raw_title, 'url': url, 'source': '搜狗搜索',
                        'summary': '', 'published_at': None,
                    })
            self._log(f'搜狗(fallback): {len(results)} results')
            return results

        for block in blocks[:limit]:
            tm = re.search(r'<a[^>]*href="([^"]*)"[^>]*>(?:<[^>]*>)*([\s\S]*?)</a>', block, re.I)
            if not tm:
                continue
            raw_link, raw_title = tm.group(1), clean_html(tm.group(2))
            url = raw_link if raw_link.startswith('http') else f'https://www.sogou.com{raw_link}'
            if not raw_title or not url.startswith('http') or 'javascript' in raw_link:
                continue

            sm = re.search(r'(?:class="str_info|class="abstract|class="str-text|class="space-txt|class="star-wiki)[^"]*"[^>]*>([\s\S]*?)</(?:div|p|span)>', block, re.I)
            summary = clean_html(sm.group(1)) if sm else ''
            pub_at = _extract_sogou_date(summary)

            results.append({
                'title': raw_title, 'url': url, 'source': '搜狗搜索',
                'summary': truncate(summary), 'published_at': pub_at,
            })
        self._log(f'搜狗: {len(results)} results')
        return results

    # ─── Google News RSS ───

    def _search_google_news(self, keyword, limit=8):
        results = []
        query = urllib.parse.quote(keyword)
        # hl=en-US 避免在某些网络环境下被阻断（gl=CN 导致）
        ok, text, _ = self.fetch(
            f'https://news.google.com/rss/search?q={query}&hl=en-US',
            timeout=10, accept='application/rss+xml,application/xml,text/xml'
        )
        if not ok or not text:
            return results

        items = re.split(r'<item[>\s]', text, flags=re.I)[1:]
        for item in items[:limit]:
            tm = re.search(r'<title[^>]*>([\s\S]*?)</title>', item, re.I)
            lm = re.search(r'<link[^>]*>([\s\S]*?)</link>', item, re.I)
            dm = re.search(r'<description[^>]*>([\s\S]*?)</description>', item, re.I)
            pm = re.search(r'<pubDate[^>]*>([\s\S]*?)</pubDate>', item, re.I)

            title = clean_html(tm.group(1)) if tm else ''
            url = clean_html(lm.group(1)) if lm else ''
            summary = clean_html(dm.group(1)) if dm else ''
            pub_at = parse_iso_date(clean_html(pm.group(1))) if pm else None

            if title and url:
                results.append({
                    'title': title, 'url': url, 'source': 'Google News',
                    'summary': truncate(summary), 'published_at': pub_at,
                })
        self._log(f'Google News: {len(results)} results')
        return results
