import { useState } from 'react';
import { cn } from '../lib/utils';

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

      <div className="p-4">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border',
            sourceStyles[h.source] || 'bg-white/5 text-gray-400 border-white/10'
          )}>
            <span className="text-[12px] leading-none">{sourceIcons[h.source] || '📌'}</span>
            {h.source}
          </span>
          {h.keyword_text && (
            <span className="text-[11px] text-indigo-300/40 font-mono tracking-tight">
              #{h.keyword_text}
            </span>
          )}
          <span className="text-[11px] text-white/15 ml-auto font-mono tabular-nums">
            {timeAgo(h.discovered_at)}
          </span>
        </div>

        {/* Title */}
        <a
          href={h.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block text-[13px] text-white/85 hover:text-indigo-300 transition-colors font-medium leading-relaxed line-clamp-2"
        >
          {h.title}
        </a>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 space-y-2.5 animate-slide-up">
            {h.summary && (
              <p className="text-[12px] text-white/35 leading-relaxed">{h.summary}</p>
            )}
            {h.ai_reason && (
              <div className={cn(
                'text-[11px] px-3 py-2 rounded-xl leading-relaxed border',
                isFake
                  ? 'bg-rose-500/5 text-rose-400/70 border-rose-500/10'
                  : 'bg-emerald-500/5 text-emerald-400/60 border-emerald-500/10'
              )}>
                <span className="mr-1">🤖</span>
                {h.ai_reason}
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/[0.02]">
          {/* Score badge */}
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold',
            scoreBg, scoreColor
          )}>
            {isFake ? '🚫 虚假' : `${score}%`}
          </span>
          <div className="flex-1" />
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
  const [filter, setFilter] = useState('all');

  const filtered = hotspots.filter(h => {
    if (filter === 'verified') return h.is_verified && !h.is_fake;
    if (filter === 'fake') return h.is_fake;
    return true;
  });

  const counts = {
    all: hotspots.length,
    verified: hotspots.filter(h => h.is_verified && !h.is_fake).length,
    fake: hotspots.filter(h => h.is_fake).length,
  };

  const filters = [
    { id: 'all', label: '全部', count: counts.all, accent: 'bg-white/5' },
    { id: 'verified', label: '真实', count: counts.verified, accent: 'bg-emerald-500/5' },
    { id: 'fake', label: '虚假', count: counts.fake, accent: 'bg-rose-500/5' },
  ];

  return (
    <div className="animate-fade-in flex flex-col h-full overflow-hidden">
      {/* Filter tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 mb-3">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'relative px-3.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-300',
              filter === f.id
                ? 'bg-white/[0.06] text-white shadow-sm'
                : 'text-white/25 hover:text-white/50 hover:bg-white/[0.02]'
            )}
          >
            {f.label}
            <span className={cn(
              'ml-1.5 text-[10px]',
              filter === f.id ? 'text-white/40' : 'text-white/15'
            )}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Content - scrollable area */}
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
            <div className="text-4xl mb-3 opacity-20">{filter === 'fake' ? '🛡️' : '📭'}</div>
            <p className="text-sm text-white/15">{filter === 'fake' ? '暂无虚假内容' : '暂无数据'}</p>
            <p className="text-xs mt-1.5 text-white/5">
              {filter === 'all' ? '添加关键词后自动扫描' : ''}
            </p>
          </div>
        ) : (
          filtered.map((h, i) => (
            <div
              key={h.id}
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: 'both' }}
            >
              <HotspotCard h={h} onMarkFake={onMarkFake} isLatest={i === 0 && filter === 'all'} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
