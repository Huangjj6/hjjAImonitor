import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { cn } from '../lib/utils';


/* ───── 分类色系 ───── */
const categoryColors = {
  'AI': 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  '编程': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  '科技': 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  '商业': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  '安全': 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  'general': 'bg-white/8 text-white/50 border-white/12',
};

const categories = ['AI', '编程', '科技', '商业', '安全', 'general'];

/* ───── 小标题 ───── */
function SectionTitle({ icon, label, accent = 'indigo' }) {
  const borders = {
    indigo: 'border-indigo-500/20',
    cyan: 'border-cyan-500/20',
    emerald: 'border-emerald-500/20',
    amber: 'border-amber-500/20',
  };
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={cn('w-5 h-5 rounded-md border flex items-center justify-center text-[11px]', borders[accent])}>
        {icon}
      </div>
      <h3 className="text-[13px] font-semibold text-white/75">{label}</h3>
    </div>
  );
}

/* ───── 卡片容器 ───── */
function Card({ children, className }) {
  return (
    <div className={cn(
      'rounded-2xl border border-white/[0.10] bg-white/[0.04] hover:border-indigo-500/15 transition-all duration-500',
      'p-5 sm:p-6',
      'shadow-[0_4px_16px_rgba(0,0,0,0.25)]',
      className
    )}>
      {children}
    </div>
  );
}

export default function ManagePage({
  keywords = [],
  onAdd,
  onToggle,
  onDelete,
  loading,
  scanning,
  onScanningChange,
}) {
  const { get, post, put } = useApi();
  const [settings, setSettings] = useState({});
  const [saveMsg, setSaveMsg] = useState('');

  const [newKeyword, setNewKeyword] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const pollRef = useRef(null);

  // 挂载时检查扫描状态
  useEffect(() => {
    loadSettings();
    checkScanStatus();
    return () => {
      // 清理轮询
      if (pollRef.current) {
        pollRef.current.aborted = true;
      }
    };
  }, []);

  // 当外部通过 WebSocket 将 scanning 置为 false 时，立即中止轮询
  useEffect(() => {
    if (!scanning && pollRef.current) {
      pollRef.current.aborted = true;
    }
  }, [scanning]);

  const loadSettings = async () => {
    const res = await get('/settings');
    if (res.success) setSettings(res.data);
  };

  const checkScanStatus = async () => {
    try {
      const res = await get('/settings/scheduler-status');
      if (res?.success) {
        if (res.data.isScanning) {
          onScanningChange?.(true);
          pollScanStatus();
        } else {
          // 组件卸载期间扫描已结束 → 恢复按钮状态
          onScanningChange?.(false);
        }
      }
    } catch (e) { /* ignore */ }
  };

  const handleSave = async (key, value) => {
    await put('/settings', { [key]: value });
    setSaveMsg('✅ 已保存');
    setTimeout(() => setSaveMsg(''), 2000);
    loadSettings();
  };

  const handleTriggerScan = async () => {
    onScanningChange?.(true);
    setSaveMsg('');
    const res = await post('/settings/trigger-scan');
    if (res.success) {
      pollScanStatus();
    } else {
      onScanningChange?.(false);
    }
  };

  const pollScanStatus = async () => {
    const ctx = {};
    pollRef.current = ctx;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      if (ctx.aborted) return;
      try {
        const res = await get('/settings/scheduler-status');
        if (ctx.aborted) return;
        if (res?.success && !res.data.isScanning) {
          onScanningChange?.(false);
          return;
        }
      } catch (e) { /* ignore */ }
    }
    onScanningChange?.(false);
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    await onAdd(newKeyword.trim(), 'general');
    setNewKeyword('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddKeyword();
  };

  const enabledCount = keywords.filter(k => k.enabled).length;

  /* ───── 爬取间隔预设 ───── */
  const currentInterval = settings.crawler_interval || '10';
  const presets = [
    { v: '5', label: '5分钟', desc: '实时', icon: '⚡', color: 'emerald' },
    { v: '10', label: '10分钟', desc: '高频', icon: '🔥', color: 'cyan' },
    { v: '15', label: '15分钟', desc: '标准', icon: '🔄', color: 'violet' },
    { v: '30', label: '30分钟', desc: '低频', icon: '🌙', color: 'amber' },
    { v: '60', label: '60分钟', desc: '节能', icon: '💤', color: 'slate' },
  ];

  const activeColorMap = {
    emerald: 'border-emerald-500/50 bg-emerald-500/12 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.12)]',
    cyan: 'border-cyan-500/50 bg-cyan-500/12 text-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.12)]',
    violet: 'border-violet-500/50 bg-violet-500/12 text-violet-300 shadow-[0_0_14px_rgba(139,92,246,0.12)]',
    amber: 'border-amber-500/50 bg-amber-500/12 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.12)]',
    slate: 'border-white/20 bg-white/8 text-white/60',
  };

  const freqLabel = (v) => {
    const n = parseInt(v);
    if (n <= 5) return '≈288次/天';
    if (n <= 10) return '≈144次/天';
    if (n <= 15) return '≈96次/天';
    if (n <= 30) return '≈48次/天';
    return '≈24次/天';
  };

  return (
    <div className="h-full flex flex-col space-y-3 animate-fade-in overflow-hidden">
      {/* Toast */}
      {saveMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-sm font-medium animate-slide-up shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
          {saveMsg}
        </div>
      )}

      {/* 可滚动的卡片区域 */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">

      {/* ─── 关键词监控 ─── */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon="⌨" label="关键词监控" accent="cyan" />
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className={cn(
              'relative group flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-300 overflow-hidden border-0 cursor-pointer',
              scanning && 'opacity-60 cursor-not-allowed'
            )}
            style={{
              background: scanning
                ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10))'
                : 'linear-gradient(135deg, rgba(99,102,241,0.30), rgba(139,92,246,0.20))',
              boxShadow: scanning
                ? '0 0 10px rgba(99,102,241,0.10)'
                : '0 0 20px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            onMouseEnter={e => {
              if (scanning) return;
              e.currentTarget.style.boxShadow = '0 0 36px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.12)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              if (scanning) return;
              e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <span className={cn('relative z-10 text-base', scanning && 'animate-spin')}>
              {scanning ? '🔄' : '⚡'}
            </span>
            <span className="relative z-10 text-indigo-100">
              {scanning ? '扫描中...' : '立即扫描'}
            </span>
            {!scanning && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-white/25 mb-4">添加你关心的关键词，AI 将自动扫描全平台热点</p>

        {/* 添加行 */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="输入关键词，如 GPT-5、Gemini…"
              className="input-neon"
              disabled={loading}
            />
            <div className={cn(
              'absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300 bg-gradient-to-r from-indigo-500/5 via-cyan-500/5 to-transparent',
              inputFocused ? 'opacity-100' : 'opacity-0'
            )} />
          </div>
          <button
            onClick={handleAddKeyword}
            disabled={loading || !newKeyword.trim()}
            className="btn-neon btn-neon-primary whitespace-nowrap"
          >
            + 添加
          </button>
        </div>

        {/* 关键词列表 */}
        {keywords.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <span className="text-2xl opacity-25">🛰️</span>
            </div>
            <p className="text-[13px] text-white/25">还没有监控关键词</p>
            <p className="text-[11px] text-white/12 mt-1">添加后自动开始扫描</p>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/20 font-mono">
                共 {keywords.length} 个 · {enabledCount} 个启用
              </span>
            </div>
            <div className="space-y-1.5">
              {keywords.map((kw, i) => (
                <div
                  key={kw.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl transition-all duration-300 border group',
                    kw.enabled
                      ? 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]'
                      : 'bg-transparent border-transparent opacity-35 hover:opacity-55'
                  )}
                  style={{ animationDelay: `${Math.min(i * 35, 180)}ms` }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <label className="toggle flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={!!kw.enabled}
                        onChange={() => onToggle(kw.id, !kw.enabled)}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <div className="min-w-0">
                      <div className={cn(
                        'text-[13px] font-medium truncate',
                        kw.enabled ? 'text-white/80' : 'text-white/25 line-through'
                      )}>
                        {kw.keyword}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(kw.id)}
                    className="text-white/10 hover:text-rose-400 transition-colors ml-3 flex-shrink-0 p-1.5 rounded-lg hover:bg-rose-500/8 opacity-0 group-hover:opacity-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ─── 扫描设置 ─── */}
      <Card>
        <SectionTitle icon="⚙" label="扫描设置" accent="indigo" />
        <p className="text-[11px] text-white/25 mb-4">控制自动扫描频率与通知方式</p>

        {/* 爬取间隔 */}
        <div className="mb-5">
          <div className="text-[13px] text-white/60 font-medium mb-2.5">爬取间隔</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {presets.map(p => {
              const active = currentInterval === p.v;
              return (
                <button
                  key={p.v}
                  onClick={() => handleSave('crawler_interval', p.v)}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium border transition-all duration-300',
                    active
                      ? activeColorMap[p.color]
                      : 'border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/[0.12] hover:text-white/55'
                  )}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                  {active && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-current rounded-full border-2 border-dark-950 shadow-[0_0_6px_currentColor]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <span className="text-[11px] text-white/30">每</span>
            <span className="text-[13px] font-semibold text-white/70 font-mono">{currentInterval}</span>
            <span className="text-[11px] text-white/30">分钟扫描 · {freqLabel(currentInterval)}</span>
          </div>
        </div>

        {/* 邮件通知 */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-[13px] text-white/60 font-medium">邮件通知</div>
            <div className="text-[11px] text-white/20 mt-0.5">发现新热点时通过 SMTP 发送邮件</div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.email_enabled === 'true'}
              onChange={e => handleSave('email_enabled', e.target.checked ? 'true' : 'false')}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </Card>
      </div>
    </div>
  );
}
