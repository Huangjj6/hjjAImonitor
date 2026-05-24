# -*- coding: utf-8 -*-
"""HackerNews — Algolia Search API"""

import urllib.parse
from .base import BaseSource
from utils import truncate


class HackerNewsSource(BaseSource):
    name = 'hackernews'
    display_name = 'HackerNews'

    def search(self, keyword, limit=8, **kwargs):
        results = []
        query = urllib.parse.quote(keyword)
        data = self.fetch_json(
            f'https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage={limit}',
            timeout=10
        )
        if not data:
            return results

        for hit in data.get('hits', [])[:limit]:
            title = hit.get('title', '')
            url = hit.get('url') or f'https://news.ycombinator.com/item?id={hit.get("objectID", "")}'
            text = hit.get('story_text') or hit.get('comment_text') or ''
            summary = truncate(text) or f"Points: {hit.get('points', 0)} | Comments: {hit.get('num_comments', 0)}"
            pub_at = hit.get('created_at')

            if title:
                results.append({
                    'title': title, 'url': url, 'source': 'HackerNews',
                    'summary': summary, 'published_at': pub_at,
                })
        self._log(f'{len(results)} results')
        return results
