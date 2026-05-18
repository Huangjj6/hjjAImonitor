import { useState, useEffect } from 'react';

export default function Navbar({ activeTab, setActiveTab, connected, notificationCount }) {
  const [time, setTime] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const tabs = [
    { id: 'dashboard', label: '雷达看板', icon: '◎' },
    { id: 'manage', label: '管理', icon: '⌨' },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'nav-blur shadow-[0_4px_24px_rgba(0,0,0,0.45)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3 select-none">
          <div className="relative w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center overflow-hidden">
            <span className="text-xl relative z-10">🔍</span>
            {connected && (
              <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-none">
              <span className="text-white/90">Hot</span>
              <span className="text-indigo-300">Monitor</span>
            </h1>
            <p className="text-[10px] text-white/25 font-mono tracking-widest mt-0.5">AI 热点雷达</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 bg-white/[0.02] border border-indigo-500/10 rounded-xl p-1 backdrop-blur-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3.5 py-2 rounded-[10px] text-[12px] font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'text-white bg-indigo-500/15 border border-indigo-500/25 shadow-[0_0_16px_rgba(99,102,241,0.15)]'
                  : 'text-white/35 hover:text-indigo-300/80 hover:bg-indigo-500/8'
              }`}
            >
              <span className="mr-1.5 text-[13px]">{tab.icon}</span>
              {tab.label}
              {tab.id === 'dashboard' && notificationCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-rose-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-fade-in px-1">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          {/* Connection indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <span className={`pulse-dot ${!connected && '!bg-red-400 !shadow-[0_0_6px_rgba(248,113,113,0.5)]'}`} />
            <span className={`text-[10px] font-mono font-medium ${
              connected ? 'text-emerald-400/70' : 'text-red-400/70'
            }`}>
              {connected ? 'LIVE' : 'OFF'}
            </span>
          </div>
          {/* Time */}
          <span className="text-[11px] text-white/15 font-mono tabular-nums hidden sm:block">
            {time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </nav>
  );
}
