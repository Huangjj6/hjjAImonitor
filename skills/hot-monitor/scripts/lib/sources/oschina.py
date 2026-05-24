# -*- coding: utf-8 -*-
"""开源中国 — HTML 搜索"""

import re
import urllib.parse
from .base import BaseSource
from utils import clean_html, truncate, parse_relative_date, parse_iso_date


class OschinaSource(BaseSource):
    name = 'oschina'
    display_name = '开源中国'

    def search(self, keyword, limit=8, **kwargs):
        results = []
        query = urllib.parse.quote(keyword)
        ok, text, _ = self.fetch(
            f'https://www.oschina.net/search?q={query}&scope=news',
            timeout=15,
            headers={'Referer': 'https://www.oschina.net'}
        )
        if not ok or not text:
            return results

        blocks = re.split(r'class="item\s', text, flags=re.I)[1:]
        for block in blocks[:limit]:
            tm = re.search(r'<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', block, re.I)
            if not tm:
                continue
            url, raw_title = tm.group(1), clean_html(tm.group(2))
            if url.startswith('/'):
                url = f'https://www.oschina.net{url}'
            if not raw_title or not url.startswith('http'):
                continue

            dm = re.search(r'class="description"[^>]*>([\s\S]*?)</div>', block, re.I)
            if not dm:
                dm = re.search(r'<p[^>]*>([\s\S]*?)</p>', block, re.I)
            summary = clean_html(dm.group(1)) if dm else ''

            # 日期
            em = re.search(r'class="extra"[^>]*>([\s\S]*?)</div>', block, re.I)
            pub_at = None
            if em:
                date_text = clean_html(em.group(1))
                pub_at = parse_iso_date(date_text) or parse_relative_date(date_text)
            if not pub_at:
                dm2 = re.search(r'(\d{4}-\d{2}-\d{2})', block)
                if dm2:
                    pub_at = parse_iso_date(dm2.group(1))

            results.append({
                'title': raw_title, 'url': url, 'source': '开源中国',
                'summary': truncate(summary), 'published_at': pub_at,
            })
        self._log(f'{len(results)} results')
        return results
