# -*- coding: utf-8 -*-
"""Bilibili — 官方 API + HTML 降级 + 人物搜索 + 空间视频"""

import re
import json
import urllib.parse
from .base import BaseSource
from utils import clean_html, truncate


class BilibiliSource(BaseSource):
    name = 'bilibili'
    display_name = 'Bilibili'

    def _headers(self, referer=None):
        """返回 Bilibili 兼容请求头（含 Cookie）"""
        h = {
            'Referer': referer or 'https://www.bilibili.com/',
            'Origin': 'https://www.bilibili.com',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local',
        }
        return h

    def search(self, keyword, limit=8, **kwargs):
        keyword_type = kwargs.get('keyword_type', 'topic')
        query = urllib.parse.quote(keyword)

        if keyword_type == 'person':
            return self._search_person(query, limit)
        else:
            results = self._search_video_api(query, limit)
            if results:
                return results
            return self._search_video_html(query, limit)

    # ─── 视频搜索（topic/organization） ───

    def _search_video_api(self, query, limit):
        """通过官方 API 搜索视频"""
        results = []
        api_url = f'https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={query}&order=new'
        data = self.fetch_json(api_url, timeout=10, headers=self._headers(referer=f'https://search.bilibili.com/all?keyword={query}'))
        if not data or data.get('code') != 0:
            return results

        items = data.get('data', {}).get('result', [])
        for item in items[:limit]:
            title = clean_html(item.get('title') or item.get('uname', ''))
            bvid = item.get('bvid', item.get('aid', ''))
            url = f'https://www.bilibili.com/video/{bvid}' if bvid else ''
            summary = truncate(clean_html(item.get('description') or item.get('tag', '')))
            pub_at = None
            if item.get('pubdate'):
                from datetime import datetime, timezone
                pub_at = datetime.fromtimestamp(item['pubdate'], tz=timezone.utc).isoformat()

            if title and url:
                results.append({
                    'title': title, 'url': url, 'source': 'Bilibili',
                    'summary': summary, 'published_at': pub_at,
                })
        self._log(f'视频API: {len(results)} results')
        return results

    def _search_video_html(self, query, limit):
        """视频搜索 HTML 降级"""
        results = []
        ok, text, _ = self.fetch(
            f'https://search.bilibili.com/all?keyword={query}&order=pubdate',
            timeout=10,
            headers={'Referer': 'https://www.bilibili.com/', 'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local'}
        )
        if not ok or not text:
            return results

        # 从 __INITIAL_STATE__ 提取
        sm = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});', text)
        if not sm:
            # 尝试匹配常规搜索结果结构
            blocks = re.split(r'class="video-item"', text, flags=re.I)[1:]
            for block in blocks[:limit]:
                tm = re.search(r'href="([^"]*)"[^>]*title="([^"]*)"', block)
                if not tm:
                    continue
                url, title = tm.group(1), clean_html(tm.group(2))
                if not url.startswith('http'):
                    url = f'https:{url}'
                sm2 = re.search(r'class="des"[^>]*>([\s\S]*?)</span>', block)
                summary = truncate(clean_html(sm2.group(1))) if sm2 else ''
                results.append({
                    'title': title, 'url': url, 'source': 'Bilibili',
                    'summary': summary, 'published_at': None,
                })
            self._log(f'视频HTML(结构): {len(results)} results')
            return results

        try:
            state = json.loads(sm.group(1))
        except json.JSONDecodeError:
            return results

        items = state.get('flow', {}).get('result', []) or state.get('video', {}).get('result', [])
        for item in items[:limit]:
            title = clean_html(item.get('title', ''))
            bvid = item.get('bvid') or str(item.get('aid', ''))
            url = f'https://www.bilibili.com/video/{bvid}' if bvid else ''
            summary = truncate(clean_html(item.get('description', '')))
            pub_at = None
            if item.get('pubdate'):
                from datetime import datetime, timezone
                pub_at = datetime.fromtimestamp(item['pubdate'], tz=timezone.utc).isoformat()

            if title and url:
                results.append({
                    'title': title, 'url': url, 'source': 'Bilibili',
                    'summary': summary, 'published_at': pub_at,
                })
        self._log(f'视频HTML(initial_state): {len(results)} results')
        return results

    # ─── 人物搜索（person） ───

    def _search_person(self, query, limit):
        """人物搜索全流程：API 搜用户 → 拿空间视频 → HTML 降级"""
        # Step 1: API 搜索用户
        users = self._search_user_api(query)
        if users:
            results = []
            # 对每个用户添加简介 + 最新视频
            for user_info in users[:2]:
                results.append({
                    'title': f"{user_info['uname']} - Bilibili UP主",
                    'url': f"https://space.bilibili.com/{user_info['mid']}",
                    'source': 'Bilibili',
                    'summary': f"简介: {user_info.get('usign', '无')} | 粉丝: {user_info.get('fans', 0)} | 视频: {user_info.get('videos', 0)}",
                    'published_at': None,
                })
                # Step 2: 获取该 UP 主最新视频
                videos = self._search_space_videos(user_info['mid'], limit)
                results.extend(videos)
            self._log(f'人物搜索: {len(results)} 条结果（含视频）')
            return results

        # Step 3: API 失败，HTML 降级
        return self._search_user_html(query, limit)

    def _search_user_api(self, query):
        """Bilibili API 搜索用户"""
        api_url = f'https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword={query}'
        data = self.fetch_json(api_url, timeout=10, headers=self._headers(referer=f'https://search.bilibili.com/all?keyword={query}'))
        if not data or data.get('code') != 0:
            return []
        return data.get('data', {}).get('result', [])

    def _search_space_videos(self, mid, limit):
        """获取 UP 主空间最新视频"""
        results = []
        if not mid:
            return results
        url = f'https://api.bilibili.com/x/space/arc/search?mid={mid}&ps={min(limit, 5)}&pn=1'
        data = self.fetch_json(url, timeout=10, headers=self._headers(referer=f'https://space.bilibili.com/{mid}'))
        if not data or data.get('code') != 0:
            return results

        vlist = data.get('data', {}).get('list', {}).get('vlist', [])
        for video in vlist[:limit]:
            title = clean_html(video.get('title', ''))
            bvid = video.get('bvid', '')
            url = f'https://www.bilibili.com/video/{bvid}' if bvid else ''
            desc = truncate(clean_html(video.get('description', '')))
            summary = desc or f"播放: {video.get('play', 0)} | 弹幕: {video.get('video_review', 0)}"
            pub_at = None
            if video.get('created'):
                from datetime import datetime, timezone
                pub_at = datetime.fromtimestamp(video['created'], tz=timezone.utc).isoformat()

            if title and url:
                results.append({
                    'title': title, 'url': url, 'source': 'Bilibili',
                    'summary': summary, 'published_at': pub_at,
                })
        self._log(f'空间视频(mid={mid}): {len(results)} results')
        return results

    def _search_user_html(self, query, limit):
        """人物搜索 HTML 降级（upuser 搜索页）"""
        results = []
        ok, text, _ = self.fetch(
            f'https://search.bilibili.com/upuser?keyword={query}',
            timeout=15,
            headers={'Referer': 'https://www.bilibili.com/', 'Cookie': 'buvid3=local; b_nut=1700000000; _uuid=local'}
        )
        if not ok or not text:
            return results

        # 尝试匹配用户卡片
        blocks = re.split(r'class="(?:user-card|bili-user-card|user-item)"', text, flags=re.I)[1:]
        for block in blocks[:limit]:
            # 用户名称 + 链接
            nm = re.search(r'class="(?:user-name|name|title)"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>', block, re.I)
            if not nm:
                continue
            raw_link, uname = nm.group(1), clean_html(nm.group(2))
            href = f'https:{raw_link}' if raw_link.startswith('//') else raw_link
            if not href.startswith('http'):
                continue

            fm = re.search(r'class="(?:user-fans|fans)"[^>]*>([\s\S]*?)</', block, re.I)
            dm = re.search(r'class="(?:user-desc|desc|sign)"[^>]*>([\s\S]*?)</', block, re.I)
            fans = clean_html(fm.group(1)) if fm else ''
            desc = clean_html(dm.group(1)) if dm else ''
            summary = f"{f'粉丝: {fans}' if fans else ''} {f'简介: {desc}' if desc else ''}".strip()

            results.append({
                'title': f'{uname} - Bilibili UP主',
                'url': href,
                'source': 'Bilibili',
                'summary': summary or 'Bilibili UP主',
                'published_at': None,
            })

        # 如果没有卡片结构，尝试 JSON-LD
        if not results:
            sm = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});', text)
            if sm:
                try:
                    state = json.loads(sm.group(1))
                    users = state.get('userSearchResult', []) or state.get('users', [])
                    for user in users[:limit]:
                        uname = user.get('uname', '')
                        mid = user.get('mid', '')
                        if uname and mid:
                            results.append({
                                'title': f'{uname} - Bilibili UP主',
                                'url': f'https://space.bilibili.com/{mid}',
                                'source': 'Bilibili',
                                'summary': f"简介: {user.get('usign', '无')}",
                                'published_at': None,
                            })
                except json.JSONDecodeError:
                    pass

        self._log(f'人物HTML降级: {len(results)} results')
        return results
