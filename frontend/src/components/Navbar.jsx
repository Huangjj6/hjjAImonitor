export default function Navbar({ activeTab, setActiveTab, connected, notificationCount }) {
  const tabs = [
    { id: 'dashboard', label: '雷达看板', icon: '◎' },
    { id: 'keywords', label: '关键词', icon: '⌨' },
    { id: 'settings', label: '设置', icon: '⚙' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 nav-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🔍</span>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white/80">
              Hot<span className="text-white/40">Monitor</span>
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-dark-800 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'text-neon-green bg-dark-700 shadow-lg'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
              {tab.id === 'dashboard' && notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-pink rounded-full text-[10px] flex items-center justify-center font-bold">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`pulse-dot ${connected ? '' : '!bg-red-500'}`} 
                  style={{ animationDuration: connected ? '1.5s' : '0.5s' }} />
            {connected ? 'Live' : 'Offline'}
          </div>
          <span className="text-xs text-gray-600 font-mono">
            {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </nav>
  );
}
