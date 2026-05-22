import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cn, normalizeUrl } from '../lib/utils';

// localStorage 持久化
const FILTER_KEY = 'hotspot-filters';
function loadFilters() {
  try { return JSON.parse(localStorage.getItem(FILTER_KEY)) || {}; } catch { return {}; }
}
function saveFilters(obj) {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(obj)); } catch {}
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('+') ? '' : 'Z'));
    const diff = Date.now() - d.getTime();
    if (diff < 0) return '刚刚';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  } catch { return ''; }
}

function formatPubDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('+') ? '' : 'Z'));
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return dateStr; }
}

function HotspotCard({ h, onMarkFake, isLatest }) {
  const [expanded, setExpanded] = useState(false);
  const isFake = h.is_fake;
  const score = Math.round((h.ai_score || 0) * 100);

  const sourceStyles = {
    'Twitter/X': 'bg-sky-500/10 text-sky-400 border-sky-500/15',
    'DuckDuckGo': 'bg-amber-500/10 text-amber-400 border-amber-500/15',
    'Bing News': 'bg-violet-500/10 text-violet-400 border-violet-500/15',
    'Google News': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
  };

  const sourceIcons = {
    'Twitter/X': '𝕏',
    'DuckDuckGo': '🔍',
    'Bing News': '📰',
    'Google News': '📰',
  };

  const scoreColor = isFake
    ? 'text-red-400/60'
    : score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400';

  const scoreBg = isFake
    ? 'bg-red-500/5'
    : score >= 80 ? 'bg-emerald-500/5' : score >= 50 ? 'bg-amber-500/5' : 'bg-rose-500/5';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={cn(
        'group rounded-xl transition-all duration-300 cursor-pointer border relative',
        isFake
          ? 'bg-rose-500/[0.04] border-rose-500/16 opacity-50 hover:opacity-70'
          : 'bg-white/[0.04] border-white/[0.08] hover:border-violet-500/30 hover:bg-violet-500/[0.03] shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-[0_0_20px_rgba(139,92,246,0.08)]'
      )}
    >
      {/* Latest badge */}
      {isLatest && !isFake && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.3)] backdrop-blur-sm">
            <span className="text-[11px] leading-none">🔥</span>
            最新
          </span>
        </div>
      )}

      <div className="p-2.5">
        {/* Meta row */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border',
            sourceStyles[h.source] || 'bg-white/5 text-gray-400 border-white/10'
          )}>
            {h.source}
          </span>
          <span className="text-[10px] text-white/15 ml-auto font-mono tabular-nums">
            {timeAgo(h.discovered_at)}
          </span>
        </div>

        {/* Title */}
        <a
          href={normalizeUrl(h.url, h.source)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block text-[12px] text-white/85 hover:text-indigo-300 transition-colors font-medium leading-snug line-clamp-1"
        >
          {h.title}
        </a>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-2 space-y-1.5 text-[11px] animate-slide-up">
            {h.summary && (
              <p className="text-white/30 leading-relaxed">{h.summary.slice(0, 120)}</p>
            )}
            {/* 时间元信息 */}
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/20 font-mono">
              {h.published_at && !isNaN(new Date(h.published_at).getTime()) && (
                <span className="inline-flex items-center gap-0.5">
                  📅 {formatPubDate(h.published_at)}
                </span>
              )}
              {h.keyword_text && (
                <span className="inline-flex items-center gap-0.5">
                  🏷️ {h.keyword_text}
                </span>
              )}
            </div>
            {h.ai_reason && (
              <div className={cn(
                'px-2 py-1.5 rounded-lg leading-relaxed border text-[11px]',
                isFake
                  ? 'bg-rose-500/5 text-rose-400/60 border-rose-500/10'
                  : 'bg-indigo-500/5 text-indigo-400/60 border-indigo-500/10'
              )}>
                {h.ai_reason}
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/[0.02]">
          <span className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold',
            scoreBg, scoreColor
          )}>
            {isFake ? '🚫' : `${score}%`}
          </span>
          <span className="flex-1" />
          {!isFake && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkFake?.(h.id); }}
              className="text-[10px] text-white/15 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded hover:bg-rose-500/5"
            >
              标记虚假
            </button>
          )}
          <span className="text-[11px] text-white/10 opacity-0 group-hover:opacity-100 transition-all select-none">
            {expanded ? '收起 ▲' : '展开 ▼'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HotspotTimeline({ hotspots = [], loading, onMarkFake }) {
  // 从 localStorage 恢复
  const saved = useMemo(() => loadFilters(), []);
  const [statusFilter, setStatusFilter] = useState(saved.statusFilter || 'all');
  const [sortMode, setSortMode] = useState(saved.sortMode || 'discovered');
  const [sortAsc, setSortAsc] = useState(saved.sortAsc || false);
  const [timeRange, setTimeRange] = useState(saved.timeRange || 'all');
  const [keywordFilter, setKeywordFilter] = useState(saved.keywordFilter || '');
  const [kwOpen, setKwOpen] = useState(false);
  const kwRef = useRef(null);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState(saved.searchQuery || '');

  // 点击外部关闭下拉
  useEffect(() => {
    if (!kwOpen && !sortOpen) return;
    const handler = (e) => {
      if (kwOpen && kwRef.current && !kwRef.current.contains(e.target)) setKwOpen(false);
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [kwOpen, sortOpen]);

  // 持久化
  const persist = useCallback((patch) => {
    const current = loadFilters();
    const next = { ...current, ...patch };
    saveFilters(next);
  }, []);

  // 时间范围计算
  const getTimeCutoff = (range) => {
    if (range === '1h') return Date.now() - 3600000;
    if (range === 'today') {
      const d = new Date(); d.setHours(0,0,0,0);
      return d.getTime();
    }
    if (range === '3d') return Date.now() - 259200000;
    if (range === '7d') return Date.now() - 604800000;
    return 0;
  };

  // ---- 组合过滤 ----
  const filtered = useMemo(() => {
    let result = hotspots;

    // 状态筛选
    if (statusFilter === 'verified') result = result.filter(h => h.is_verified && !h.is_fake);
    else if (statusFilter === 'fake') result = result.filter(h => h.is_fake);

    // 时间范围
    const cutoff = getTimeCutoff(timeRange);
    if (cutoff > 0) {
      result = result.filter(h => {
        const ts = new Date(h.discovered_at).getTime();
        return ts >= cutoff;
      });
    }

    // 关键词筛选
    if (keywordFilter) {
      result = result.filter(h => h.keyword_text === keywordFilter);
    }

    // 标题搜索
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(h =>
        (h.title || '').toLowerCase().includes(q) ||
        (h.summary || '').toLowerCase().includes(q)
      );
    }

    // 排序
    result = [...result].sort((a, b) => {
      const direction = sortAsc ? 1 : -1;

      if (sortMode === 'published') {
        const da = new Date(a.published_at || a.discovered_at).getTime();
        const db = new Date(b.published_at || b.discovered_at).getTime();
        return (da - db) * direction;
      }

      if (sortMode === 'hot') {
        const scoreA = (a.ai_score || 0) * 0.6 + timeBoost(a.discovered_at) * 0.4;
        const scoreB = (b.ai_score || 0) * 0.6 + timeBoost(b.discovered_at) * 0.4;
        return (scoreB - scoreA) * direction;
      }

      // sortMode === 'discovered'（默认）
      const da = new Date(a.discovered_at).getTime();
      const db = new Date(b.discovered_at).getTime();
      return (da - db) * direction;
    });

    return result;
  }, [hotspots, statusFilter, timeRange, keywordFilter, searchQuery, sortMode, sortAsc]);

  /**
   * 时间衰减因子：越新得分越高（0~1），24小时后趋近 0.1
   */
  function timeBoost(dateStr) {
    if (!dateStr) return 0;
    const elapsed = Date.now() - new Date(dateStr).getTime();
    const hours = elapsed / 3600000;
    return Math.max(0.1, 1 - hours / 24);
  }

  // 提取所有关键词
  const allKeywords = useMemo(() => {
    const kwSet = new Set();
    hotspots.forEach(h => { if (h.keyword_text) kwSet.add(h.keyword_text); });
    return [...kwSet].sort();
  }, [hotspots]);

  // 计数
  const counts = {
    all: hotspots.length,
    verified: hotspots.filter(h => h.is_verified && !h.is_fake).length,
    fake: hotspots.filter(h => h.is_fake).length,
  };

  const statusTabs = [
    { id: 'all', label: '全部', count: counts.all },
    { id: 'verified', label: '真实', count: counts.verified },
    { id: 'fake', label: '虚假', count: counts.fake },
  ];

  const timeOptions = [
    { id: 'all', label: '全部' },
    { id: '1h', label: '1小时' },
    { id: 'today', label: '今天' },
    { id: '3d', label: '3天' },
    { id: '7d', label: '7天' },
  ];

  const hasActiveFilters = timeRange !== 'all' || keywordFilter || searchQuery.trim();

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* ====== 筛选栏 ====== */}
      <div className="flex-shrink-0 mb-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
        <div className="flex items-center gap-1 flex-wrap">
          {/* 状态 tabs */}
          {statusTabs.map(f => (
            <button
              key={f.id}
              onClick={() => {
                setStatusFilter(f.id);
                persist({ statusFilter: f.id });
              }}
              className={cn(
                'relative px-2 py-1 rounded-md text-[11px] font-medium transition-all duration-300',
                statusFilter === f.id
                  ? 'bg-white/[0.08] text-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.2)] backdrop-blur-sm'
                  : 'text-white/25 hover:text-white/55 hover:bg-white/[0.03]'
              )}
            >
              {f.label}
              <span className={cn('ml-1 text-[10px]', statusFilter === f.id ? 'text-white/50' : 'text-white/12')}>
                {f.count}
              </span>
            </button>
          ))}

          <span className="w-px h-4 bg-white/[0.06]" />

          {/* 时间范围 */}
          {timeOptions.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTimeRange(t.id);
                persist({ timeRange: t.id });
              }}
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-200 border',
                timeRange === t.id
                  ? 'bg-white/[0.06] text-white/70 border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                  : 'text-white/20 border-transparent hover:text-white/45 hover:bg-white/[0.02]'
              )}
            >
              {t.label}
            </button>
          ))}

          <span className="w-px h-4 bg-white/[0.06]" />

          {/* 关键词下拉 */}
          {allKeywords.length > 0 && (
            <div className="relative" ref={kwRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setKwOpen(prev => !prev); }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border select-none',
                  keywordFilter
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
                    : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/70'
                )}
              >
                {keywordFilter || '全部关键词'}
                <span className={cn('text-[9px] transition-transform duration-200', kwOpen && 'rotate-180')}>▾</span>
              </button>
              {kwOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-[100] min-w-[150px] rounded-xl border border-white/[0.15] shadow-[0_16px_48px_rgba(0,0,0,0.7)] py-1.5 animate-slide-up"
                  style={{ background: '#0d0d1a', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setKeywordFilter(''); persist({ keywordFilter: '' }); setKwOpen(false); }}
                    className={cn(
                      'w-full text-left px-3.5 py-2 text-[12px] transition-colors',
                      !keywordFilter
                        ? 'text-indigo-300 bg-indigo-500/10'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                    )}
                  >
                    全部关键词
                  </button>
                  {allKeywords.map(k => (
                    <button
                      key={k}
                      onClick={() => { setKeywordFilter(k); persist({ keywordFilter: k }); setKwOpen(false); }}
                      className={cn(
                        'w-full text-left px-3.5 py-2 text-[12px] transition-colors',
                        keywordFilter === k
                          ? 'text-indigo-300 bg-indigo-500/10'
                          : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <span className="w-px h-4 bg-white/[0.06]" />

          {/* 标题搜索 */}
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-white/15 pointer-events-none">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                persist({ searchQuery: e.target.value });
              }}
              placeholder="搜索..."
              className="bg-white/[0.03] border border-white/[0.06] rounded-lg text-[11px] text-white/50 pl-7 pr-2.5 py-1.5 w-24 outline-none focus:border-indigo-500/20 focus:bg-white/[0.05] placeholder:text-white/10 transition-all duration-200"
            />
          </div>

          {/* 结果数 */}
          <span className="text-[10px] text-white/15 font-mono tabular-nums ml-auto">{filtered.length} 条</span>

          {/* 排序方式 */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setSortOpen(prev => !prev); }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border select-none',
                'bg-white/[0.04] text-white/50 border-white/[0.08] hover:border-white/20 hover:text-white/70'
              )}
            >
              {sortMode === 'discovered' ? '发现时间' : sortMode === 'published' ? '发布时间' : '综合热度'}
              <span className={cn('text-[9px] transition-transform duration-200', sortOpen && 'rotate-180')}>▾</span>
            </button>
            {sortOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-[100] min-w-[130px] rounded-xl border border-white/[0.15] shadow-[0_16px_48px_rgba(0,0,0,0.7)] py-1.5 animate-slide-up"
                style={{ background: '#0d0d1a', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  { value: 'discovered', label: '发现时间' },
                  { value: 'published', label: '发布时间' },
                  { value: 'hot', label: '综合热度' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortMode(opt.value); persist({ sortMode: opt.value }); setSortOpen(false); }}
                    className={cn(
                      'w-full text-left px-3.5 py-2 text-[12px] transition-colors',
                      sortMode === opt.value
                        ? 'text-indigo-300 bg-indigo-500/10'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 升降序 */}
          <button
            onClick={() => {
              setSortAsc(prev => {
                persist({ sortAsc: !prev });
                return !prev;
              });
            }}
            className="px-2 py-1 rounded-lg text-[12px] text-white/25 hover:text-white/55 hover:bg-white/[0.04] transition-all duration-200 flex-shrink-0"
            title={sortAsc ? '升序' : '降序'}
          >
            {sortAsc ? '↑' : '↓'}
          </button>

          {/* 清除筛选 */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setKeywordFilter('');
                setTimeRange('all');
                setSearchQuery('');
                setSortMode('discovered');
                setSortAsc(false);
                saveFilters({});
              }}
              className="text-[10px] text-rose-400/50 hover:text-rose-400 transition-colors flex-shrink-0 ml-1"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* ====== 列表内容 ====== */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
        {loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative w-10 h-10 mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-white/[0.04]" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400/60 animate-spin" />
            </div>
            <p className="text-sm text-white/15">正在扫描热点...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-4xl mb-3 opacity-20">
              {hasActiveFilters ? '🔍' : statusFilter === 'fake' ? '🛡️' : '📭'}
            </div>
            <p className="text-sm text-white/15">
              {hasActiveFilters ? '没有匹配的筛选结果' : statusFilter === 'fake' ? '暂无虚假内容' : '暂无数据'}
            </p>
            <p className="text-xs mt-1.5 text-white/5">
              {hasActiveFilters ? '尝试调整筛选条件' : statusFilter === 'all' ? '添加关键词后自动扫描' : ''}
            </p>
          </div>
        ) : (
          filtered.map((h, i) => (
            <div
              key={h.id}
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: 'both' }}
            >
              <HotspotCard h={h} onMarkFake={onMarkFake} isLatest={i === 0 && statusFilter === 'all'} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
