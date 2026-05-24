# -*- coding: utf-8 -*-
"""
JSON 文件存储 — 关键词、热点、设置的 CRUD
"""

import json
import os
import uuid
from datetime import datetime, timezone

# 数据目录（相对于 lib 目录的上级 = scripts/ 目录的上级 = skill 根目录）
_LIB_DIR = os.path.dirname(os.path.abspath(__file__))
_SCRIPTS_DIR = os.path.dirname(_LIB_DIR)
_SKILL_DIR = os.path.dirname(_SCRIPTS_DIR)
DATA_DIR = os.path.join(_SKILL_DIR, 'data')

KEYWORDS_FILE = os.path.join(DATA_DIR, 'keywords.json')
HOTSPOTS_FILE = os.path.join(DATA_DIR, 'hotspots.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')

_DEFAULT_SETTINGS = {
    'sources': 'web,hackernews,reddit,github,bilibili,gitee,oschina',
    'maxResultsPerSource': 8,
    'requestDelay': 2,
    'excludeDomains': [
        'baike.baidu.com', 'baike.sogou.com', 'wikipedia.org',
        'zh.wikipedia.org', 'en.wikipedia.org', 'wiki.mbalib.com',
    ],
}

# ─── 基础读写 ───

def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)

def _read_json(filepath, default=None):
    if default is None:
        default = []
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return default

def _write_json(filepath, data):
    _ensure_dir()
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ─── 关键词 ───

def load_keywords():
    return _read_json(KEYWORDS_FILE)

def save_keywords(keywords):
    _write_json(KEYWORDS_FILE, keywords)

def add_keyword(keyword, category='general', keyword_type=None):
    from utils import guess_keyword_type
    keywords = load_keywords()
    if any(k['keyword'].lower() == keyword.lower() for k in keywords):
        raise ValueError(f'关键词 "{keyword}" 已存在')
    if keyword_type is None:
        keyword_type = guess_keyword_type(keyword)
    kw = {
        'id': str(uuid.uuid4()),
        'keyword': keyword,
        'category': category,
        'keyword_type': keyword_type,
        'enabled': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    keywords.append(kw)
    save_keywords(keywords)
    return kw

def get_enabled_keywords():
    return [k for k in load_keywords() if k.get('enabled', True)]

def remove_keyword(target):
    """target 可以是 id 或 keyword 文本"""
    keywords = load_keywords()
    before = len(keywords)
    keywords = [k for k in keywords if k['id'] != target and k['keyword'] != target]
    if len(keywords) == before:
        raise ValueError(f'关键词 "{target}" 不存在')
    save_keywords(keywords)
    return before - len(keywords)

# ─── 热点 ───

def load_hotspots():
    return _read_json(HOTSPOTS_FILE)

def save_hotspots(hotspots):
    _write_json(HOTSPOTS_FILE, hotspots)

def add_hotspot(item):
    """添加一条热点。item 需含 keyword_id, title, url, source 等字段"""
    hotspots = load_hotspots()
    if any(h['url'] == item.get('url') for h in hotspots):
        return None  # 已存在，跳过
    h = {
        'id': str(uuid.uuid4()),
        'keyword_id': item.get('keyword_id', ''),
        'title': item.get('title', ''),
        'url': item.get('url', ''),
        'source': item.get('source', ''),
        'summary': item.get('summary', ''),
        'published_at': item.get('published_at'),
        'discovered_at': datetime.now(timezone.utc).isoformat(),
    }
    hotspots.append(h)
    save_hotspots(hotspots)
    return h

def add_hotspots_batch(items, skip_existing=True):
    """批量添加热点，返回新增数量"""
    hotspots = load_hotspots()
    existing_urls = {h['url'] for h in hotspots}
    added = 0
    now = datetime.now(timezone.utc).isoformat()
    for item in items:
        url = item.get('url', '')
        if skip_existing and url in existing_urls:
            continue
        h = {
            'id': str(uuid.uuid4()),
            'keyword_id': item.get('keyword_id', ''),
            'title': item.get('title', ''),
            'url': url,
            'source': item.get('source', ''),
            'summary': item.get('summary', ''),
            'published_at': item.get('published_at'),
            'discovered_at': now,
        }
        hotspots.append(h)
        existing_urls.add(url)
        added += 1
    save_hotspots(hotspots)
    return added

# ─── 设置 ───

def load_settings():
    defaults = dict(_DEFAULT_SETTINGS)
    saved = _read_json(SETTINGS_FILE, {})
    defaults.update(saved)
    return defaults

def save_settings(settings):
    _write_json(SETTINGS_FILE, settings)
