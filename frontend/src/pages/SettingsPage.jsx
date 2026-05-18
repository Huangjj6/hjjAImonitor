import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { cn } from '../lib/utils';

export default function SettingsPage() {
  const { get, post, put } = useApi();
  const [settings, setSettings] = useState({});
  const [configStatus, setConfigStatus] = useState({});
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    loadSettings();
    loadConfigStatus();
  }, []);

  const loadSettings = async () => {
    const res = await get('/settings');
    if (res.success) setSettings(res.data);
  };

  const loadConfigStatus = async () => {
    const res = await get('/config-status');
    if (res.success) setConfigStatus(res.data);
  };

  const handleSave = async (key, value) => {
    await put('/settings', { [key]: value });
    setSaveMsg('✅ 已保存');
    setTimeout(() => setSaveMsg(''), 2000);
    loadSettings();
  };

  const handleTriggerScan = async () => {
    const res = await post('/settings/trigger-scan');
    setSaveMsg(res.message || '扫描已启动');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleSchedulerStatus = async () => {
    const res = await get('/settings/scheduler-status');
    if (res.success) {
      setSaveMsg(`调度器: ${res.data.running ? '运行中' : '已停止'} · 间隔 ${res.data.intervalMinutes} 分钟`);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const SectionHeader = ({ icon, iconColor, title }) => (
    <div className="flex items-center gap-2 mb-4">
      <div className={cn(
        'w-6 h-6 rounded-lg border flex items-center justify-center',
        iconColor === 'purple' && 'bg-violet-500/10 border-violet-500/15',
        iconColor === 'cyan' && 'bg-cyan-500/10 border-cyan-500/15',
        iconColor === 'amber' && 'bg-amber-500/10 border-amber-500/15',
        iconColor === 'emerald' && 'bg-emerald-500/10 border-emerald-500/15',
      )}>
        <span className={cn(
          'text-xs',
          iconColor === 'purple' && 'text-violet-400',
          iconColor === 'cyan' && 'text-cyan-400',
          iconColor === 'amber' && 'text-amber-400',
          iconColor === 'emerald' && 'text-emerald-400',
        )}>{icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-white/70">{title}</h3>
    </div>
  );

  const Card = ({ children, className }) => (
    <div className={cn(
      'rounded-2xl border border-white/[0.04] bg-white/[0.01] backdrop-blur-sm p-6',
      className
    )}>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Save toast */}
      {saveMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-slide-up shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
          {saveMsg}
        </div>
      )}

      {/* 配置状态 */}
      <Card>
        <SectionHeader icon="⚡" iconColor="purple" title="服务状态" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'OpenRouter AI', key: 'openrouter', icon: '🧠' },
            { label: 'Twitter API', key: 'twitter', icon: '𝕏' },
            { label: '邮件通知', key: 'email', icon: '📧' },
            { label: 'WebSocket', key: 'ws', icon: '🔗' },
          ].map(item => (
            <div key={item.key} className="rounded-xl bg-white/[0.02] border border-white/[0.03] p-3.5 text-center hover:border-white/[0.06] transition-all duration-300">
              <div className="text-2xl mb-1.5">{item.icon}</div>
              <div className="text-[10px] text-white/25 mb-1.5">{item.label}</div>
              <div className={cn(
                'text-[11px] font-medium',
                configStatus[item.key] !== undefined
                  ? configStatus[item.key] ? 'text-emerald-400' : 'text-rose-400'
                  : 'text-white/10'
              )}>
                {configStatus[item.key] !== undefined
                  ? configStatus[item.key] ? '已配置' : '未配置'
                  : '检测中...'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 基本设置 */}
      <Card>
        <SectionHeader icon="⚙" iconColor="cyan" title="基本设置" />
        <div className="space-y-6">
          {/* 爬取间隔 */}
          <div>
            <div className="mb-1">
              <div className="text-sm text-white/70">爬取间隔</div>
              <div className="text-[11px] text-white/20 mt-0.5">自动扫描热点的间隔时间，间隔越短数据越实时</div>
            </div>

            {/* 预设按钮组 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {(() => {
                const currentVal = settings.crawler_interval || '10';
                const presets = [
                  { value: '5', label: '5分钟', desc: '实时', icon: '⚡', color: 'emerald' },
                  { value: '10', label: '10分钟', desc: '高频', icon: '🔥', color: 'cyan' },
                  { value: '15', label: '15分钟', desc: '标准', icon: '🔄', color: 'violet' },
                  { value: '30', label: '30分钟', desc: '低频', icon: '🌙', color: 'amber' },
                  { value: '60', label: '60分钟', desc: '节能', icon: '💤', color: 'slate' },
                ];
                const colorMap = {
                  emerald: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
                  cyan: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]',
                  violet: 'border-violet-500/50 bg-violet-500/10 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]',
                  amber: 'border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
                  slate: 'border-white/15 bg-white/3 text-white/50',
                };
                return presets.map(p => {
                  const isActive = currentVal === p.value;
                  return (
                    <button
                      key={p.value}
                      onClick={() => handleSave('crawler_interval', p.value)}
                      className={cn(
                        'group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
                        'border transition-all duration-300 cursor-pointer',
                        isActive
                          ? colorMap[p.color]
                          : 'border-white/[0.05] bg-white/[0.015] text-white/30 hover:border-white/[0.1] hover:text-white/50 hover:bg-white/[0.03]'
                      )}
                    >
                      <span className="text-base transition-transform duration-300 group-hover:scale-110">
                        {p.icon}
                      </span>
                      <span>{p.label}</span>
                      {isActive && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-current rounded-full border-2 border-dark-950 shadow-[0_0_6px_currentColor]" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>

            {/* 当前选择说明 */}
            <div className="flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-white/[0.015] border border-white/[0.03]">
              <span className="text-[11px] text-white/25">当前：每</span>
              <span className="text-sm font-semibold text-white/80 font-mono tabular-nums">
                {settings.crawler_interval || '10'}
              </span>
              <span className="text-[11px] text-white/25">分钟自动扫描一次</span>
              <span className="flex-1" />
              <span className="text-[10px] text-white/10 font-mono">
                {(() => {
                  const v = parseInt(settings.crawler_interval || '10');
                  if (v <= 5) return '≈288次/天';
                  if (v <= 10) return '≈144次/天';
                  if (v <= 15) return '≈96次/天';
                  if (v <= 30) return '≈48次/天';
                  return '≈24次/天';
                })()}
              </span>
            </div>
          </div>

          {/* 邮件通知开关 */}
          <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
            <div>
              <div className="text-sm text-white/70">邮件通知</div>
              <div className="text-[11px] text-white/20 mt-0.5">通过 SMTP 发送热点邮件提醒</div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.email_enabled === 'true'}
                onChange={(e) => handleSave('email_enabled', e.target.checked ? 'true' : 'false')}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </Card>

      {/* 手动操作 */}
      <Card>
        <SectionHeader icon="🎮" iconColor="amber" title="手动操作" />
        <div className="flex flex-wrap gap-3">
          <button onClick={handleTriggerScan} className="btn-neon btn-neon-primary">
            🚀 立即扫描
          </button>
          <button onClick={handleSchedulerStatus} className="btn-neon">
            📊 调度状态
          </button>
        </div>
      </Card>

      {/* 配置说明 */}
      <Card>
        <SectionHeader icon="📖" iconColor="emerald" title="配置说明" />
        <div className="text-[11px] text-white/20 space-y-2 font-mono leading-relaxed">
          <p>1. 复制 <code className="text-indigo-400/70 bg-white/[0.03] px-1.5 py-0.5 rounded text-[10px]">backend/.env.example</code> 为 <code className="text-indigo-400/70 bg-white/[0.03] px-1.5 py-0.5 rounded text-[10px]">.env</code></p>
          <p>2. 填入 OpenRouter API Key（从 <a href="https://openrouter.ai/keys" target="_blank" className="text-indigo-400/70 hover:text-indigo-300 transition-colors">openrouter.ai/keys</a> 获取）</p>
          <p>3. （可选）填入 Twitter API Key（从 <a href="https://twitterapi.io/" target="_blank" className="text-indigo-400/70 hover:text-indigo-300 transition-colors">twitterapi.io</a> 获取）</p>
          <p>4. （可选）填入 SMTP 邮件配置以启用邮件通知</p>
          <p>5. 重启后端服务生效</p>
        </div>
      </Card>
    </div>
  );
}
