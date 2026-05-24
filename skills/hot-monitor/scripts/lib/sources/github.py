# -*- coding: utf-8 -*-
"""GitHub — Trending + Repository Search"""

import re
import urllib.parse
from .base import BaseSource
from utils import truncate, clean_html


class GitHubSource(BaseSource):
    name = 'github'
    display_name = 'GitHub'

    def search(self, keyword, limit=8, **kwargs):
        """GitHub 搜索：优先 Trending 榜单，同时做关键词搜索"""
        results = []
        query = urllib.parse.quote(keyword)

        # 1. GitHub Trending（当天热门仓库，与关键词无关）
        results.extend(self._search_trending(min(limit, 5)))

        # 2. 关键词搜索仓库
        results.extend(self._search_repos(query, limit))

        # URL 去重（排除同一 Trending 仓库被二次计入）
        seen = set()
        unique = []
        for r in results:
            if r['url'] not in seen:
                seen.add(r['url'])
                unique.append(r)
        self._log(f'Trending + Search: {len(unique)} results')
        return unique

    def _search_trending(self, limit=5):
        """GitHub Trending HTML 抓取"""
        results = []
        ok, text, _ = self.fetch(
            'https://github.com/trending',
            timeout=10,
            headers={'Accept': 'text/html,application/xhtml+xml'}
        )
        if not ok or not text:
            return results

        blocks = re.split(r'<article\s[^>]*class="Box-row"', text, flags=re.I)[1:]
        for block in blocks[:limit]:
            tm = re.search(r'<h2[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', block, re.I)
            if not tm:
                continue
            href, raw_title = tm.group(1), clean_html(tm.group(2)).replace('\n', ' ').strip()
            repo_path = raw_title.replace(' ', '').strip().replace('/', ' / ')
            url = f'https://github.com{href}' if href.startswith('/') else href

            dm = re.search(r'<p[^>]*>([\s\S]*?)</p>', block, re.I)
            summary = truncate(clean_html(dm.group(1))) if dm else ''

            lm = re.search(r'itemprop="programmingLanguage"[^>]*>([^<]+)</span>', block, re.I)
            lang = clean_html(lm.group(1)) if lm else ''
            title = f'{repo_path}{" [" + lang + "]" if lang else ""}'

            results.append({
                'title': title, 'url': url, 'source': 'GitHub Trending',
                'summary': summary, 'published_at': None,
            })

        return results

    def _search_repos(self, query, limit):
        """关键词搜索仓库"""
        results = []
        data = self.fetch_json(
            f'https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page={limit}',
            timeout=10,
            headers={'Accept': 'application/vnd.github.v3+json'}
        )
        if not data:
            return results

        for item in data.get('items', [])[:limit]:
            lang = item.get('language', '')
            title = item.get('full_name', item.get('name', ''))
            if lang:
                title += f' [{lang}]'
            url = item.get('html_url', '')
            desc = truncate(item.get('description', ''))
            summary = desc or f"Stars: {item.get('stargazers_count', 0)} | Forks: {item.get('forks_count', 0)}"
            pub_at = item.get('updated_at') or item.get('created_at')

            if title and url:
                results.append({
                    'title': title, 'url': url, 'source': 'GitHub',
                    'summary': summary, 'published_at': pub_at,
                })
        return results
