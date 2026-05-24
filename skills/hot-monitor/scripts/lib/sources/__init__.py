# -*- coding: utf-8 -*-
"""
信息源注册表 — 名称到类的映射
新增源：在此处加一行即可
"""

from .web import WebSource
from .hackernews import HackerNewsSource
from .reddit import RedditSource
from .github import GitHubSource
from .bilibili import BilibiliSource
from .gitee import GiteeSource
from .oschina import OschinaSource

SOURCE_REGISTRY = {
    'web':        WebSource,
    'hackernews': HackerNewsSource,
    'reddit':     RedditSource,
    'github':     GitHubSource,
    'bilibili':   BilibiliSource,
    'gitee':      GiteeSource,
    'oschina':    OschinaSource,
}

def get_source(name, request_delay=2.0):
    """根据名称获取源实例"""
    cls = SOURCE_REGISTRY.get(name)
    if cls is None:
        raise ValueError(f'未知信息源: {name}。可用源: {", ".join(SOURCE_REGISTRY.keys())}')
    return cls(request_delay=request_delay)

def get_all_sources(request_delay=2.0):
    """获取所有已注册的源"""
    return [cls(request_delay=request_delay) for cls in SOURCE_REGISTRY.values()]

def list_sources():
    """列出所有可用源"""
    result = []
    for name, cls in SOURCE_REGISTRY.items():
        result.append({'name': name, 'display_name': cls.display_name})
    return result
