# -*- coding: utf-8 -*-
"""
爬虫调度器 — 并发控制、去重编排、结果收集
"""

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from storage import load_settings
from sources import get_source
from dedup import dedup_by_url, dedup_by_title
from utils import extract_domain


def crawl_single_source(source_name, keyword, limit, request_delay, keyword_type='topic'):
    """爬取单个信息源，返回结果列表。异常时返回空列表。"""
    try:
        source = get_source(source_name, request_delay=request_delay)
        items = source.search(keyword, limit=limit, keyword_type=keyword_type)
        return items
    except Exception as e:
        print(f'[Crawler]   ❌ {source_name}: {e}', file=sys.stderr)
        return []


def crawl_all_sources(keyword, source_names=None, limit=None, keyword_type='topic'):
    """
    并行爬取所有指定信息源。
    返回去重排序后的结果列表。
    """
    settings = load_settings()
    if source_names is None:
        source_names = [s.strip() for s in settings.get('sources', '').split(',') if s.strip()]
    if limit is None:
        limit = settings.get('maxResultsPerSource', 8)
    request_delay = settings.get('requestDelay', 2)
    exclude_domains = settings.get('excludeDomains', [])

    print(f'[Crawler] 🔍 关键词: "{keyword}" (类型: {keyword_type})', file=sys.stderr)
    print(f'[Crawler] 📡 信息源: {", ".join(source_names)}', file=sys.stderr)
    print(f'[Crawler] 📊 每源上限: {limit} 条', file=sys.stderr)

    # 并行爬取所有源
    all_results = []
    max_workers = min(len(source_names), 4)  # 最多 4 并发
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(crawl_single_source, name, keyword, limit, request_delay, keyword_type): name
            for name in source_names
        }
        for future in as_completed(futures):
            name = futures[future]
            try:
                items = future.result()
                print(f'[Crawler]   ✅ {name}: {len(items)} 条', file=sys.stderr)
                all_results.extend(items)
            except Exception as e:
                print(f'[Crawler]   ❌ {name}: {e}', file=sys.stderr)

    # 1. URL 去重 + 域名排除
    before = len(all_results)
    all_results = dedup_by_url(all_results, exclude_domains)
    url_deduped = len(all_results)
    print(f'[Crawler] URL 去重: {before} → {url_deduped}', file=sys.stderr)

    # 2. 标题相似度去重
    before2 = len(all_results)
    all_results = dedup_by_title(all_results, threshold=0.8)
    print(f'[Crawler] 标题去重: {before2} → {len(all_results)}', file=sys.stderr)

    # 3. 补充 domain 字段
    for item in all_results:
        if 'domain' not in item:
            item['domain'] = extract_domain(item.get('url', ''))

    # 4. 排序：有发布日期的新在前
    all_results.sort(key=lambda x: x.get('published_at') or '', reverse=True)

    print(f'[Crawler] ✅ 最终结果: {len(all_results)} 条\n', file=sys.stderr)
    return all_results
