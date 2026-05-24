# -*- coding: utf-8 -*-
"""Gitee — Repository Search API"""

import urllib.parse
from .base import BaseSource
from utils import truncate


class GiteeSource(BaseSource):
    name = 'gitee'
    display_name = 'Gitee'

    def search(self, keyword, limit=8, **kwargs):
        results = []
        query = urllib.parse.quote(keyword)
        data = self.fetch_json(
            f'https://gitee.com/api/v5/search/repositories?q={query}&sort=stars&order=desc&per_page={limit}',
            timeout=10
        )
        if not data:
            return results

        for item in (data or [])[:limit]:
            title = item.get('full_name', item.get('name', ''))
            url = item.get('html_url', '')
            desc = truncate(item.get('description', ''))
            summary = desc or f"Stars: {item.get('stargazers_count', 0)} | Forks: {item.get('forks_count', 0)}"
            pub_at = item.get('updated_at')

            if title and url:
                results.append({
                    'title': title, 'url': url, 'source': 'Gitee',
                    'summary': summary, 'published_at': pub_at,
                })
        self._log(f'{len(results)} results')
        return results
