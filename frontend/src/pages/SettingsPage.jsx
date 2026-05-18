import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 配置状态 */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <span className="text-neon-purple">⚡</span> 服务状态
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'OpenRouter AI', key: 'openrouter', icon: '🧠' },
            { label: 'Twitter API', key: 'twitter', icon: '𝕏' },
            { label: '邮件通知', key: 'email', icon: '📧' },
            { label: 'WebSocket', key: 'ws', icon: '🔗' },
          ].map(item => (
            <div key={item.key} className="bg-dark-700/50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-[10px] text-gray-500 mb-1">{item.label}</div>
              <div className={`text-xs font-medium ${
                configStatus[item.key] !== undefined
                  ? configStatus[item.key] ? 'text-neon-green' : 'text-red-400'
                  : 'text-gray-600'
              }`}>
                {configStatus[item.key] !== undefined
                  ? configStatus[item.key] ? '✅ 已配置' : '⚠️ 未配置'
                  : '...'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 基本设置 */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <span className="text-neon-cyan">⚙</span> 基本设置
        </h3>
        <div className="space-y-4">
          {/* 爬取间隔 */}
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-300 mb-1">爬取间隔</div>
              <div className="text-xs text-gray-600">自动扫描热点的间隔时间，间隔越短数据越实时</div>
            </div>

            {/* 预设按钮组 */}
            <div className="flex flex-wrap gap-2">
              {(() => {
                const currentVal = settings.crawler_interval || '10';
                const presets = [
                  { value: '5', label: '5分钟', desc: '实时', icon: '⚡', color: 'neon-green' },
                  { value: '10', label: '10分钟', desc: '高频', icon: '🔥', color: 'neon-cyan' },
                  { value: '15', label: '15分钟', desc: '标准', icon: '🔄', color: 'neon-purple' },
                  { value: '30', label: '30分钟', desc: '低频', icon: '🌙', color: 'neon-yellow' },
                  { value: '60', label: '60分钟', desc: '节能', icon: '💤', color: 'gray' },
                ];
                return presets.map(p => {
                  const isActive = currentVal === p.value;
                  const activeColorMap = {
                    'neon-green': 'border-neon-green/50 bg-neon-green/10 text-neon-green shadow-[0_0_12px_rgba(0,255,136,0.15)]',
                    'neon-cyan': 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan shadow-[0_0_12px_rgba(0,204,255,0.15)]',
                    'neon-purple': 'border-neon-purple/50 bg-neon-purple/10 text-neon-purple shadow-[0_0_12px_rgba(168,85,247,0.15)]',
                    'neon-yellow': 'border-neon-yellow/50 bg-neon-yellow/10 text-neon-yellow shadow-[0_0_12px_rgba(255,184,0,0.15)]',
                    'gray': 'border-white/20 bg-white/5 text-white/60',
                  };
                  return (
                    <button
                      key={p.value}
                      onClick={() => handleSave('crawler_interval', p.value)}
                      className={`
                        group relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                        border transition-all duration-300 cursor-pointer
                        ${isActive
                          ? activeColorMap[p.color]
                          : 'border-white/[0.06] bg-white/[0.02] text-gray-500 hover:border-white/[0.12] hover:text-gray-300 hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      <span className="text-base transition-transform duration-300 group-hover:scale-110">
                        {p.icon}
                      </span>
                      <span>{p.label}</span>
                      {isActive && (
                        <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-current rounded-full border-2 border-dark-800" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>

            {/* 当前选择说明 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <span className="text-xs text-gray-500">当前：每</span>
              <span className="text-sm font-semibold text-white font-mono tabular-nums">
                {settings.crawler_interval || '10'}
              </span>
              <span className="text-xs text-gray-500">分钟自动扫描一次</span>
              <span className="flex-1" />
              <span className="text-[10px] text-gray-600 font-mono">
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm text-gray-300">邮件通知</div>
              <div className="text-xs text-gray-600">通过 SMTP 发送热点邮件提醒</div>
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
      </div>

      {/* 手动操作 */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <span className="text-neon-yellow">🎮</span> 手动操作
        </h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleTriggerScan} className="btn-neon">
            🚀 立即扫描
          </button>
          <button onClick={handleSchedulerStatus} className="btn-neon">
            📊 调度状态
          </button>
        </div>
      </div>

      {/* 配置说明 */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <span className="text-neon-green">📖</span> 配置说明
        </h3>
        <div className="text-xs text-gray-500 space-y-2 font-mono">
          <p>1. 复制 <code className="text-neon-cyan bg-dark-800 px-1.5 py-0.5 rounded">backend/.env.example</code> 为 <code className="text-neon-cyan bg-dark-800 px-1.5 py-0.5 rounded">.env</code></p>
          <p>2. 填入 OpenRouter API Key（从 <a href="https://openrouter.ai/keys" target="_blank" className="text-neon-cyan hover:underline">openrouter.ai/keys</a> 获取）</p>
          <p>3. （可选）填入 Twitter API Key（从 <a href="https://twitterapi.io/" target="_blank" className="text-neon-cyan hover:underline">twitterapi.io</a> 获取）</p>
          <p>4. （可选）填入 SMTP 邮件配置以启用邮件通知</p>
          <p>5. 重启后端服务生效</p>
        </div>
      </div>

      {saveMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-card px-6 py-3 text-sm text-neon-green animate-slide-up z-50">
          {saveMsg}
        </div>
      )}
    </div>
  );
}
