import { useState } from 'react';

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

function HotspotCard({ h, onMarkFake }) {
  const [expanded, setExpanded] = useState(false);
  const isFake = h.is_fake;
  const score = Math.round((h.ai_score || 0) * 100);

  const sourceStyles = {
    'Twitter/X': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    'DuckDuckGo': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Bing News': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'Google News': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };

  const sourceIcons = {
    'Twitter/X': '𝕏',
    'DuckDuckGo': '🔍',
    'Bing News': '📰',
    'Google News': '📰',
  };

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`group rounded-2xl transition-all duration-300 cursor-pointer border ${
        isFake
          ? 'bg-red-500/3 border-red-500/8 opacity-50'
          : 'bg-white/[0.02] border-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.04]'
      }`}
    >
      <div className="p-4">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-2.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${
            sourceStyles[h.source] || 'bg-white/5 text-gray-400 border-white/10'
          }`}>
            <span className="text-[13px] leading-none">{sourceIcons[h.source] || '📌'}</span>
            {h.source}
          </span>
          {h.keyword_text && (
            <span className="text-[11px] text-white/25 font-mono tracking-tight">
              #{h.keyword_text}
            </span>
          )}
          <span className="text-[11px] text-white/20 ml-auto font-mono tabular-nums">
            {timeAgo(h.discovered_at)}
          </span>
        </div>

        {/* Title */}
        <a
          href={h.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="block text-[13px] text-white/85 hover:text-sky-400 transition-colors font-medium leading-relaxed line-clamp-2"
        >
          {h.title}
        </a>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 space-y-2.5 animate-fade-in">
            {h.summary && (
              <p className="text-[12px] text-white/40 leading-relaxed">{h.summary}</p>
            )}
            {h.ai_reason && (
              <div className={`text-[11px] px-3 py-2 rounded-xl leading-relaxed ${
                isFake
                  ? 'bg-red-500/5 text-red-400/80'
                  : 'bg-emerald-500/5 text-emerald-400/70'
              }`}>
                🤖 {h.ai_reason}
              </div>
            )}
          </div>
        )}

        {/* Bottom bar */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-white/[0.03]">
          <span className={`text-[11px] font-mono font-semibold tracking-tight ${
            isFake ? 'text-red-400/60' : score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {isFake ? '🚫 虚假' : `${score}%`}
          </span>
          <div className="flex-1" />
          {!isFake && (
            <button
              onClick={(e) => { e.stopPropagation(); onMarkFake?.(h.id); }}
              className="text-[10px] text-white/20 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              标记虚假
            </button>
          )}
          <span className="text-[11px] text-white/15 opacity-0 group-hover:opacity-100 transition-all">
            {expanded ? '收起' : '展开'}
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
    { id: 'all', label: '全部', count: counts.all },
    { id: 'verified', label: '真实', count: counts.verified },
    { id: 'fake', label: '虚假', count: counts.fake },
  ];

  return (
    <div className="animate-fade-in flex flex-col h-full">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 px-1">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`relative px-4 py-2 rounded-xl text-[12px] font-medium transition-all duration-300 ${
              filter === f.id
                ? 'bg-white/[0.06] text-white shadow-sm'
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] ${
              filter === f.id ? 'text-white/50' : 'text-white/20'
            }`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {loading && filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/20">
            <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/40 animate-spin mb-4" />
            <p className="text-sm">正在扫描热点...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-white/20">
            <div className="text-4xl mb-3 opacity-30">{filter === 'fake' ? '🛡️' : '📭'}</div>
            <p className="text-sm">{filter === 'fake' ? '暂无虚假内容' : '暂无数据'}</p>
            <p className="text-xs mt-1.5 text-white/10">
              {filter === 'all' ? '添加关键词后自动扫描' : ''}
            </p>
          </div>
        ) : (
          filtered.map((h) => (
            <HotspotCard key={h.id} h={h} onMarkFake={onMarkFake} />
          ))
        )}
      </div>
    </div>
  );
}
