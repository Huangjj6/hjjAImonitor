# -*- coding: utf-8 -*-
"""
信息源基类 — 提供 fetch、超时、重试、限流等通用能力
"""

import time
import json
import urllib.request
import urllib.error
from utils import random_ua, default_headers


class BaseSource:
    """所有信息源的基类"""

    name = 'base'
    display_name = 'Base'

    def __init__(self, request_delay=2.0):
        self.request_delay = request_delay
        self._last_request = 0.0

    def _throttle(self):
        """请求节流：确保两次请求间隔 >= request_delay"""
        elapsed = time.time() - self._last_request
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)
        self._last_request = time.time()

    def fetch(self, url, timeout=10, accept=None, headers=None, max_retries=2):
        """
        安全 HTTP GET 请求。
        返回 (ok: bool, text: str, status: int)
        """
        h = default_headers()
        if accept:
            h['Accept'] = accept
        if headers:
            h.update(headers)

        last_error = None
        for attempt in range(max_retries + 1):
            self._throttle()
            try:
                req = urllib.request.Request(url, headers=h)
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    text = resp.read().decode('utf-8', errors='replace')
                    return True, text, resp.status
            except urllib.error.HTTPError as e:
                last_error = f'HTTP {e.code}'
                # 429/403 退避重试
                if e.code in (429, 403, 503):
                    wait = (attempt + 1) * 3
                    time.sleep(wait)
                    continue
                return False, '', e.code
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries:
                    time.sleep(2)
                    continue
                return False, '', 0

        return False, '', 0

    def fetch_json(self, url, timeout=10, headers=None):
        """安全 JSON GET 请求，返回解析后的 dict 或 None"""
        ok, text, status = self.fetch(url, timeout=timeout, accept='application/json', headers=headers)
        if not ok or not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    def search(self, keyword, limit=8, **kwargs):
        """
        搜索接口 — 子类必须实现。
        返回 [{title, url, source, summary, published_at}, ...]
        """
        raise NotImplementedError(f'{self.__class__.__name__}.search() not implemented')

    def _log(self, message):
        import sys
        print(f'[Crawler]   [{self.display_name}] {message}', file=sys.stderr)
