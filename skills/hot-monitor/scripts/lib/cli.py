# -*- coding: utf-8 -*-
"""
CLI 命令处理 — argparse 解析 + 各命令实现
"""

import sys
import json
import argparse
import uuid
from datetime import datetime, timezone, timedelta

from storage import (
    load_keywords, save_keywords, add_keyword, get_enabled_keywords,
    remove_keyword, load_hotspots, save_hotspots, add_hotspots_batch,
    load_settings,
)
from crawler import crawl_all_sources
from utils import guess_keyword_type
from sources import list_sources, get_source


def _json_output(data):
    """输出 JSON 到 stdout"""
    print(json.dumps(data, ensure_ascii=False, indent=None))


def _table_output(items, columns=None):
    """输出 Markdown 表格到 stdout"""
    if not items:
        print('*(无结果)*')
        return
    if columns is None:
        columns = ['#', '标题', '来源', '时间', '域名']

    # 表头
    header = '| ' + ' | '.join(columns) + ' |'
    sep = '|' + '|'.join(['------' for _ in columns]) + '|'
    print(header)
    print(sep)

    for i, item in enumerate(items, 1):
        row = [
            str(i),
            item.get('title', '')[:80],
            item.get('source', ''),
            _format_time(item.get('published_at')),
            item.get('domain', ''),
        ]
        print('| ' + ' | '.join(row) + ' |')


def _format_time(iso_str):
    """将 ISO 时间格式化为简短可读形式"""
    if not iso_str:
        return '-'
    try:
        dt = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        diff = now - dt
        if diff.days == 0:
            hours = diff.seconds // 3600
            if hours == 0:
                mins = diff.seconds // 60
                return f'{mins}分钟前' if mins > 0 else '刚刚'
            return f'{hours}小时前'
        elif diff.days < 7:
            return f'{diff.days}天前'
        else:
            return dt.strftime('%m-%d')
    except Exception:
        return iso_str[:10]


# ─── 命令处理 ───

def cmd_add(args):
    """添加关键词"""
    keyword = args.keyword
    category = args.category or 'general'
    try:
        kw = add_keyword(keyword, category)
        _json_output({'success': True, 'data': kw})
    except ValueError as e:
        _json_output({'success': False, 'error': str(e)})


def cmd_list(args):
    """列出关键词"""
    keywords = load_keywords()
    if args.enabled:
        keywords = [k for k in keywords if k.get('enabled')]
    if args.category:
        keywords = [k for k in keywords if k.get('category') == args.category]
    _json_output({'success': True, 'data': keywords, 'total': len(keywords)})


def cmd_remove(args):
    """删除关键词"""
    try:
        removed = remove_keyword(args.target)
        _json_output({'success': True, 'message': f'已删除 {removed} 个关键词'})
    except ValueError as e:
        _json_output({'success': False, 'error': str(e)})


def cmd_scan(args):
    """扫描热点"""
    keyword = args.keyword
    sources_str = args.sources
    limit = args.limit
    output_format = args.format or 'json'
    should_save = args.save

    # 确定关键词列表
    keywords_to_scan = []
    if keyword:
        keywords_to_scan = [{
            'id': str(uuid.uuid4()),
            'keyword': keyword,
            'keyword_type': guess_keyword_type(keyword),
            'enabled': True,
        }]
    else:
        keywords_to_scan = get_enabled_keywords()
        if not keywords_to_scan:
            _json_output({'success': False, 'error': '没有已启用的关键词。请先用 add 命令添加。'})
            return

    # 解析信息源
    source_names = None
    if sources_str:
        source_names = [s.strip() for s in sources_str.split(',') if s.strip()]

    # 逐个关键词扫描
    all_results = []
    for kw in keywords_to_scan:
        items = crawl_all_sources(
            kw['keyword'],
            source_names=source_names,
            limit=limit,
            keyword_type=kw.get('keyword_type', 'topic'),
        )
        for item in items:
            item['keyword_id'] = kw['id']
            item['keyword'] = kw['keyword']
        all_results.extend(items)

    output = {
        'success': True,
        'data': all_results,
        'total': len(all_results),
        'scanned_keywords': [k['keyword'] for k in keywords_to_scan],
        'timestamp': datetime.now(timezone.utc).isoformat(),
    }

    if output_format == 'table':
        _table_output(all_results)
    else:
        _json_output(output)

    # 保存到本地
    if should_save and all_results:
        added = add_hotspots_batch(all_results)
        print(f'[Save] 新增 {added} 条热点', file=sys.stderr)


def cmd_hotspots(args):
    """查看已存储的热点"""
    hotspots = load_hotspots()
    if args.keyword_id:
        hotspots = [h for h in hotspots if h.get('keyword_id') == args.keyword_id]

    # 按发现时间倒序
    hotspots.sort(key=lambda x: x.get('discovered_at', ''), reverse=True)
    limit = args.limit or 50
    result = hotspots[:limit]

    if args.format == 'table':
        _table_output(result)
    else:
        _json_output({
            'success': True,
            'data': result,
            'total': len(hotspots),
            'returned': len(result),
        })


def cmd_demo(args):
    """生成演示数据"""
    keywords = get_enabled_keywords()
    if not keywords:
        kw = add_keyword('AI 大模型', 'AI')
        keywords = [kw]

    demos = [
        {'title': 'GPT-5 正式发布：多模态推理能力大幅提升', 'source': 'TechCrunch',
         'summary': 'OpenAI 发布 GPT-5，在代码生成、数学推理和多模态理解方面取得重大突破。支持 200K 上下文窗口。'},
        {'title': 'Google DeepMind 推出 Gemini 3.0 Ultra', 'source': 'The Verge',
         'summary': 'Gemini 3.0 Ultra 在多项基准测试中超越 GPT-5，多模态任务表现尤为出色。'},
        {'title': 'AI 编程工具 Copilot X 用户突破 1 亿', 'source': 'GitHub Blog',
         'summary': 'GitHub Copilot X 全球用户突破 1 亿，代码采纳率超过 46%。'},
        {'title': '开源模型 Llama 4 在编程任务上媲美闭源模型', 'source': 'Hacker News',
         'summary': 'Meta 开源 Llama 4 在 HumanEval 基准中取得与 GPT-5 相当的成绩。'},
        {'title': '欧盟通过全球首个 AI 安全法案', 'source': 'Reuters',
         'summary': '欧盟要求所有大语言模型强制安全评估，违规最高罚全球营收 7%。'},
        {'title': 'AI Agent 框架爆发：LangChain vs AutoGPT vs CrewAI', 'source': 'Medium',
         'summary': '2026 年 AI Agent 框架生态大爆发，深度对比主流框架优劣势。'},
        {'title': '⚠️ 警惕：假冒 GPT-5 API 的钓鱼网站蔓延', 'source': '安全内参',
         'summary': '安全研究人员发现大量假冒 GPT-5 API 的钓鱼网站，提醒开发者甄别。'},
    ]

    hotspots = load_hotspots()
    added = 0
    now = datetime.now(timezone.utc)

    for i, demo in enumerate(demos):
        kw = keywords[i % len(keywords)]
        h = {
            'id': str(uuid.uuid4()),
            'keyword_id': kw['id'],
            'title': demo['title'],
            'url': f'https://example.com/demo/{uuid.uuid4()}',
            'source': demo['source'],
            'summary': demo['summary'],
            'published_at': (now - timedelta(hours=len(demos) - i)).isoformat(),
            'discovered_at': now.isoformat(),
        }
        hotspots.append(h)
        added += 1

    save_hotspots(hotspots)
    _json_output({
        'success': True,
        'message': f'已生成 {added} 条演示数据',
        'keywords': [k['keyword'] for k in keywords],
    })


def cmd_status(args):
    """查看统计信息"""
    keywords = load_keywords()
    hotspots = load_hotspots()
    settings = load_settings()

    last_updated = None
    if hotspots:
        sorted_h = sorted(hotspots, key=lambda x: x.get('discovered_at', ''), reverse=True)
        last_updated = sorted_h[0].get('discovered_at')

    _json_output({
        'success': True,
        'data': {
            'keywords': {'total': len(keywords), 'enabled': len([k for k in keywords if k.get('enabled')])},
            'hotspots': {'total': len(hotspots)},
            'sources': settings.get('sources', ''),
            'last_updated': last_updated,
        },
    })


def cmd_check(args):
    """检测信息源可用性"""
    all_srcs = list_sources()
    print(f'\U0001F50D 检测 {len(all_srcs)} 个信息源可用性...\n', file=sys.stderr)

    results = []
    for src_info in all_srcs:
        name = src_info['name']
        display = src_info['display_name']
        try:
            source_inst = get_source(name)
            items = source_inst.search('test', limit=1)
            if items is not None:
                status = '\u2705 可用'
                results.append({'source': name, 'display': display, 'status': 'ok'})
            else:
                status = '\u26a0\ufe0f 无结果'
                results.append({'source': name, 'display': display, 'status': 'empty'})
        except Exception as e:
            status = f'\u274c {e}'
            results.append({'source': name, 'display': display, 'status': 'error', 'error': str(e)})
        print(f'  {status}  {display}', file=sys.stderr)

    _json_output({'success': True, 'data': results})

    _json_output({'success': True, 'data': results})


# ─── 主入口 ───

def main():
    parser = argparse.ArgumentParser(
        prog='hot-monitor',
        description='🔍 Hot Monitor — AI 热点监控 CLI（零依赖，开箱即用）',
    )
    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    # add
    p_add = subparsers.add_parser('add', help='添加监控关键词')
    p_add.add_argument('keyword', help='关键词')
    p_add.add_argument('--category', '-c', help='分类标签', default=None)

    # list
    p_list = subparsers.add_parser('list', help='列出所有关键词')
    p_list.add_argument('--enabled', action='store_true', help='仅显示已启用')
    p_list.add_argument('--category', '-c', help='按分类筛选')

    # remove
    p_remove = subparsers.add_parser('remove', help='删除关键词')
    p_remove.add_argument('target', help='关键词 ID 或文本')

    # scan
    p_scan = subparsers.add_parser('scan', help='扫描热点')
    p_scan.add_argument('keyword', nargs='?', default=None, help='关键词（不指定则扫描所有）')
    p_scan.add_argument('--sources', '-s', help='信息源，逗号分隔', default=None)
    p_scan.add_argument('--limit', '-l', type=int, help='每源最大结果数', default=None)
    p_scan.add_argument('--format', '-f', choices=['json', 'table'], default='json', help='输出格式')
    p_scan.add_argument('--save', action='store_true', help='保存结果到本地 JSON')

    # hotspots
    p_hot = subparsers.add_parser('hotspots', help='查看已存储的热点')
    p_hot.add_argument('--limit', '-l', type=int, default=50, help='返回条数')
    p_hot.add_argument('--keyword-id', help='按关键词 ID 筛选')
    p_hot.add_argument('--format', '-f', choices=['json', 'table'], default='json', help='输出格式')

    # demo
    subparsers.add_parser('demo', help='生成演示数据')

    # status
    subparsers.add_parser('status', help='查看统计信息')

    # check
    subparsers.add_parser('check', help='检测信息源可用性')

    # 解析
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # 路由
    commands = {
        'add':      cmd_add,
        'list':     cmd_list,
        'remove':   cmd_remove,
        'scan':     cmd_scan,
        'hotspots': cmd_hotspots,
        'demo':     cmd_demo,
        'status':   cmd_status,
        'check':    cmd_check,
    }

    handler = commands.get(args.command)
    if handler:
        try:
            handler(args)
        except Exception as e:
            _json_output({'success': False, 'error': str(e)})
            sys.exit(1)
    else:
        parser.print_help()
