import { useState, useEffect, useCallback, useRef } from 'react';
import HotspotTimeline from '../components/HotspotTimeline';
import { useApi } from '../hooks/useApi';

function timeAgo(dateStr) {
  if (!dateStr) return '--';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export default function Dashboard({ notification, onDismissNotification }) {
  const { get, post } = useApi();
  const [hotspots, setHotspots] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const prevCountRef = useRef(0);

  const loadData = useCallback(async () => {
    const [hotRes, kwRes] = await Promise.all([
      get('/hotspots?limit=100'),
      get('/keywords'),
    ]);
    if (hotRes?.success) setHotspots(hotRes.data);
    if (kwRes?.success) setKeywords(kwRes.data);
    setLastScan(new Date().toISOString());
    setLoading(false);
  }, [get]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (notification) loadData();
  }, [notification, loadData]);

  const handleMarkFake = async (id) => {
    await post(`/hotspots/${id}/mark-fake`, { reason: '用户手动标记' });
    loadData();
  };

  // 统计数据
  const verified = hotspots.filter(h => h.is_verified && !h.is_fake);
  const fakes = hotspots.filter(h => h.is_fake);
  const avgScore = verified.length > 0
    ? Math.round(verified.reduce((s, h) => s + (h.ai_score || 0), 0) / verified.length * 100)
    : 0;
  const enabledKw = keywords.filter(k => k.enabled).length;

  // 来源分布
  const sourceDist = hotspots.reduce((acc, h) => {
    acc[h.source] = (acc[h.source] || 0) + 1;
    return acc;
  }, {});
  const topSource = Object.entries(sourceDist).sort((a, b) => b[1] - a[1])[0];

  // 最新热点
  const latest = hotspots[0];

  const statCards = [
    {
      label: '已发现',
      value: hotspots.length,
      sub: `最近 ${timeAgo(lastScan)} 刷新`,
      color: 'from-sky-500/20 to-indigo-500/10',
      icon: '📡',
      iconBg: 'bg-sky-500/10',
    },
    {
      label: '已确认',
      value: verified.length,
      sub: avgScore > 0 ? `平均相关度 ${avgScore}%` : '等待 AI 验证',
      color: 'from-emerald-500/20 to-teal-500/10',
      icon: '✅',
      iconBg: 'bg-emerald-500/10',
    },
    {
      label: '已过滤',
      value: fakes.length,
      sub: fakes.length > 0 ? 'AI 自动识别虚假内容' : '暂无虚假内容',
      color: 'from-rose-500/20 to-pink-500/10',
      icon: '🛡️',
      iconBg: 'bg-rose-500/10',
    },
    {
      label: '监控词',
      value: enabledKw,
      sub: `${keywords.length} 个关键词，${enabledKw} 个启用`,
      color: 'from-amber-500/20 to-orange-500/10',
      icon: '🎯',
      iconBg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Bento Grid: Stats + Source */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-2xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-500 p-5"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative z-10">
              <div className={`w-8 h-8 rounded-xl ${s.iconBg} flex items-center justify-center text-sm mb-3`}>
                {s.icon}
              </div>
              <div className="text-2xl font-bold text-white tracking-tight font-mono tabular-nums">
                {s.value}
              </div>
              <div className="text-[11px] text-white/40 mt-1 font-medium">{s.label}</div>
              <div className="text-[10px] text-white/15 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Timeline (full width, clean) */}
      <div className="rounded-2xl bg-white/[0.01] border border-white/[0.03] p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              📡 热点时间线
            </h2>
            <p className="text-[11px] text-white/20 mt-0.5">
              {topSource
                ? `主要来源: ${topSource[0]} (${topSource[1]}条)`
                : '等待数据...'}
            </p>
          </div>
        </div>
        <div className="mt-4 max-h-[calc(100vh-380px)]">
          <HotspotTimeline
            hotspots={hotspots}
            loading={loading}
            onMarkFake={handleMarkFake}
          />
        </div>
      </div>
    </div>
  );
}
