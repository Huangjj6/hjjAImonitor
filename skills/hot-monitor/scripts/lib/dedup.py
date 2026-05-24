# -*- coding: utf-8 -*-
"""
去重模块 — URL 去重 + 标题相似度去重（3-gram Jaccard）
"""

import re

# ─── URL 去重 ───

def dedup_by_url(items, exclude_domains=None):
    """URL 去重 + 排除指定域名。返回去重后的列表。"""
    if exclude_domains is None:
        exclude_domains = []
    from utils import is_excluded_domain
    seen = set()
    result = []
    for item in items:
        url = item.get('url', '')
        if not url:
            continue
        if url in seen:
            continue
        if is_excluded_domain(url, exclude_domains):
            continue
        seen.add(url)
        result.append(item)
    return result

# ─── 标题相似度去重 ───

def _norm(text):
    """标准化文本：去标点、小写"""
    if not text:
        return ''
    return re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff]', '', text.lower())

def _trigrams(s):
    """生成 3-gram 集合"""
    return {s[i:i+3] for i in range(len(s) - 2)} if len(s) >= 3 else {s}

def title_similarity(a, b):
    """3-gram Jaccard 相似度，范围 [0, 1]"""
    sa, sb = _norm(a), _norm(b)
    if not sa or not sb:
        return 0.0
    ta, tb = _trigrams(sa), _trigrams(sb)
    if not ta or not tb:
        return 0.0
    intersection = len(ta & tb)
    union = len(ta | tb)
    return intersection / union if union > 0 else 0.0

def dedup_by_title(items, threshold=0.8):
    """
    标题相似度去重。
    相似度 > threshold 的归为一组，每组保留标题最长的条目（信息量最大）。
    返回去重后的列表。
    """
    if len(items) <= 1:
        return items

    groups = []  # [[item, item, ...], ...]
    for item in items:
        title = item.get('title', '')
        added = False
        for grp in groups:
            if title_similarity(title, grp[0].get('title', '')) > threshold:
                grp.append(item)
                added = True
                break
        if not added:
            groups.append([item])

    result = []
    for grp in groups:
        if len(grp) == 1:
            result.append(grp[0])
        else:
            best = max(grp, key=lambda x: len(x.get('title', '')))
            best['_merged_count'] = len(grp)
            best['_all_sources'] = list({i.get('source', '') for i in grp})
            result.append(best)
    return result
