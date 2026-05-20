import { useState, useEffect, useCallback } from 'react';
import HotspotTimeline from '../components/HotspotTimeline';
import { StatCard } from '../components/ui/glowing-effect';
import { useApi } from '../hooks/useApi';
import { cn } from '../lib/utils';

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

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === display) return;
    const step = Math.max(1, Math.ceil(Math.abs(value - display) / 10));
    const timer = setInterval(() => {
      setDisplay(prev => {
        if (Math.abs(value - prev) <= step) return value;
        return prev + (value > prev ? step : -step);
      });
    }, 40);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
}

export default function Dashboard({ notification, onDismissNotification }) {
  const { get, post } = useApi();
  const [hotspots, setHotspots] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [pulseKey, setPulseKey] = useState(0);

  const loadData = useCallback(async () => {
    const [hotRes, kwRes] = await Promise.all([
      get('/hotspots?limit=9999'),
      get('/keywords'),
    ]);
    if (hotRes?.success) setHotspots(hotRes.data);
    if (kwRes?.success) setKeywords(kwRes.data);
    setLastScan(new Date().toISOString());
    setLoading(false);
    setPulseKey(k => k + 1);
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

  const stats = [
    { label: '已发现', value: hotspots.length, sub: `最近 ${timeAgo(lastScan)} 刷新`, icon: '📡', accent: 'cyan' },
    { label: '已确认', value: verified.length, sub: avgScore > 0 ? `平均相关度 ${avgScore}%` : '等待 AI 验证', icon: '✅', accent: 'emerald' },
    { label: '已过滤', value: fakes.length, sub: fakes.length > 0 ? 'AI 自动识别虚假内容' : '暂无虚假内容', icon: '🛡️', accent: 'rose' },
    { label: '监控词', value: enabledKw, sub: `${keywords.length} 个关键词，${enabledKw} 个启用`, icon: '🎯', accent: 'amber' },
  ];

  const latestHotspot = hotspots.length > 0 ? hotspots[0] : null;

  return (
    <div className="h-full flex flex-col space-y-3 animate-fade-in overflow-hidden">
      {/* Stats Grid */}
      <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            icon={s.icon}
            label={s.label}
            value={<AnimatedNumber value={s.value} />}
            sub={s.sub}
            accent={s.accent}
          />
        ))}
      </div>

      {/* Timeline - fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/[0.10] bg-white/[0.04] hover:border-indigo-500/10 transition-all duration-500 shadow-[0_4px_16px_rgba(0,0,0,0.22)] p-5 sm:p-6">
        <div className="flex-shrink-0 flex items-center justify-between mb-1 flex-wrap gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white/70 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
              热点时间线
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-[11px] text-white/20">
                {topSource
                  ? `主要来源: ${topSource[0]} (${topSource[1]}条)`
                  : '等待数据...'}
              </p>
              {latestHotspot && (
                <>
                  <span className="text-[10px] text-white/10">|</span>
                  <span className="text-[10px] text-emerald-400/60 font-medium flex items-center gap-1">
                    <span className="text-[11px]">🔥</span>
                    最新: 
                    <span className="text-white/40 truncate max-w-[200px] inline-block align-bottom">
                      {latestHotspot.title}
                    </span>
                  </span>
                  <span className="text-[10px] text-white/15 font-mono">
                    {timeAgo(latestHotspot.discovered_at)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 min-h-0 mt-3">
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
