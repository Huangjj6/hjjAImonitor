import { useState, useEffect, useCallback } from 'react';
import HotspotTimeline from '../components/HotspotTimeline';
import { useApi } from '../hooks/useApi';
import { cn } from '../lib/utils';

export default function Dashboard({ notification, onDismissNotification }) {
  const { get, post, del } = useApi();
  const [hotspots, setHotspots] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadData = useCallback(async () => {
    const [hotRes, kwRes] = await Promise.all([
      get('/hotspots?limit=9999'),
      get('/keywords'),
    ]);
    if (hotRes?.success) setHotspots(hotRes.data);
    if (kwRes?.success) setKeywords(kwRes.data);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 轮询扫描状态
  useEffect(() => {
    const check = async () => {
      const res = await get('/settings/scheduler-status');
      if (res?.success) setScanning(res.data.isScanning);
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [get]);

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
  const topSource = Object.entries(
    hotspots.reduce((acc, h) => { acc[h.source] = (acc[h.source] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const latestHotspot = hotspots.length > 0 ? hotspots[0] : null;

  return (
    <div className="h-full flex flex-col space-y-2 animate-fade-in overflow-hidden">
      {/* Stats Bar — 紧凑横条 */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[11px]">
        <span className="text-white/40 font-medium">📡 {hotspots.length}<span className="text-white/15 ml-1">已发现</span></span>
        <span className="w-px h-3 bg-white/[0.08]" />
        <span className="text-white/40 font-medium">✅ {verified.length}<span className="text-white/15 ml-1">已确认</span></span>
        <span className="w-px h-3 bg-white/[0.08]" />
        <span className="text-white/40 font-medium">🛡️ {fakes.length}<span className="text-white/15 ml-1">过滤</span></span>
        <span className="w-px h-3 bg-white/[0.08]" />
        <span className="text-white/40 font-medium">🎯 {enabledKw}<span className="text-white/15 ml-1">监控词</span></span>
        {avgScore > 0 && (
          <>
            <span className="w-px h-3 bg-white/[0.08]" />
            <span className="text-white/40 font-medium">📊 {avgScore}%<span className="text-white/15 ml-1">相关度</span></span>
          </>
        )}
        <span className="flex-1" />
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
          scanning ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/[0.02] text-white/20'
        )}>
          <span className={cn('w-1 h-1 rounded-full', scanning ? 'bg-cyan-400 animate-pulse' : 'bg-white/20')} />
          {scanning ? '扫描中' : '待机'}
        </span>
      </div>

      {/* Timeline - fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-white/[0.10] bg-white/[0.04] hover:border-indigo-500/10 transition-all duration-500 shadow-[0_4px_16px_rgba(0,0,0,0.22)] p-3">
        <div className="flex-shrink-0 flex items-center justify-between mb-1 flex-wrap gap-1">
          <div className="flex-1 min-w-0">
            <h2 className="text-[12px] font-semibold text-white/60 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
              热点时间线
              {topSource && <span className="text-[10px] text-white/20 font-normal">· {topSource[0]} {topSource[1]}条</span>}
              {latestHotspot && <span className="text-[10px] text-white/15 font-normal truncate max-w-[180px]">· {latestHotspot.title}</span>}
            </h2>
          </div>
          {hotspots.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[10px] text-white/15 hover:text-rose-400 transition-colors px-2 py-0.5 rounded hover:bg-rose-500/5"
            >
              🗑 清空
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 mt-1">
          <HotspotTimeline
            hotspots={hotspots}
            loading={loading}
            onMarkFake={handleMarkFake}
          />
        </div>
      </div>

      {/* 清空确认弹窗 */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="rounded-2xl border border-rose-500/20 bg-[#0d0d1a] p-5 max-w-xs w-full mx-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)] animate-slide-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-lg">⚠️</div>
              <div>
                <h3 className="text-sm font-semibold text-white/85">清空所有热点</h3>
                <p className="text-[10px] text-white/30 mt-0.5">此操作将删除 {hotspots.length} 条热点，不可撤销</p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-2 rounded-xl text-[12px] font-medium border border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setShowClearConfirm(false);
                  await del('/hotspots');
                  loadData();
                }}
                className="flex-1 px-3 py-2 rounded-xl text-[12px] font-medium bg-rose-500/15 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all duration-200"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
