# -*- coding: utf-8 -*-
"""Reddit — JSON Search API"""

import urllib.parse
from .base import BaseSource
from utils import truncate


class RedditSource(BaseSource):
    name = 'reddit'
    display_name = 'Reddit'

    def search(self, keyword, limit=8, **kwargs):
        results = []
        query = urllib.parse.quote(keyword)
        data = self.fetch_json(
            f'https://www.reddit.com/search.json?q={query}&limit={limit}&sort=new',
            timeout=10
        )
        if not data:
            return results

        for child in data.get('data', {}).get('children', [])[:limit]:
            d = child.get('data', {})
            title = d.get('title', '')
            permalink = d.get('permalink', '')
            url = f'https://www.reddit.com{permalink}' if permalink else ''
            desc = truncate(d.get('selftext', ''))
            summary = desc or f"Subreddit: r/{d.get('subreddit', 'unknown')} | Upvotes: {d.get('ups', 0)} | Comments: {d.get('num_comments', 0)}"
            pub_at = None
            if d.get('created_utc'):
                from datetime import datetime, timezone
                pub_at = datetime.fromtimestamp(d['created_utc'], tz=timezone.utc).isoformat()

            if title:
                results.append({
                    'title': title, 'url': url, 'source': 'Reddit',
                    'summary': summary, 'published_at': pub_at,
                })
        self._log(f'{len(results)} results')
        return results
