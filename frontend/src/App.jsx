import { useState, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import ManagePage from './pages/ManagePage';
import NotificationToast from './components/NotificationToast';
import { AnimatedGridBackground } from './components/ui/animated-background';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [keywords, setKeywords] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const { connected, lastNotification, setLastNotification, scanComplete } = useWebSocket();
  const { get, post, put, del, loading } = useApi();

  // 加载关键词
  const loadKeywords = useCallback(async () => {
    const res = await get('/keywords');
    if (res.success) setKeywords(res.data);
  }, [get]);

  // 初始化加载
  useEffect(() => { loadKeywords(); }, [loadKeywords]);

  // 监听通知更新计数
  useEffect(() => {
    if (lastNotification) {
      setNotificationCount(c => c + 1);
      if (activeTab === 'dashboard') {
        setTimeout(() => setNotificationCount(0), 3000);
      }
    }
  }, [lastNotification]);

  // 监听扫描完成事件 → 恢复按钮状态（替代轮询，更可靠）
  useEffect(() => {
    if (scanComplete) {
      console.log('[App] 扫描完成，恢复按钮状态');
      setScanning(false);
    }
  }, [scanComplete]);

  const handleAddKeyword = async (keyword, category) => {
    const res = await post('/keywords', { keyword, category });
    if (res.success) {
      await loadKeywords();
      return res.data;
    }
    throw new Error(res.error);
  };

  const handleToggleKeyword = async (id, enabled) => {
    // 乐观更新：立即切换 UI
    setKeywords(prev => prev.map(k => k.id === id ? { ...k, enabled: enabled ? 1 : 0 } : k));
    // 后台同步
    const res = await put(`/keywords/${id}`, { enabled });
    if (!res.success) {
      // 失败回滚
      setKeywords(prev => prev.map(k => k.id === id ? { ...k, enabled: enabled ? 0 : 1 } : k));
    }
  };

  const handleDeleteKeyword = async (id) => {
    setKeywords(prev => prev.filter(k => k.id !== id));
    const res = await del(`/keywords/${id}`);
    if (!res.success) await loadKeywords();
  };

  return (
    <AnimatedGridBackground>
      <div className="h-screen flex flex-col bg-dark-950 bg-grid overflow-hidden">
        <Navbar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            if (tab === 'dashboard') setNotificationCount(0);
          }}
          connected={connected}
          notificationCount={notificationCount}
        />

        <main className="flex-1 overflow-hidden max-w-6xl mx-auto w-full px-4 pt-16 pb-12 bg-dark-950">
          {activeTab === 'dashboard' && (
            <Dashboard
              notification={lastNotification}
              onDismissNotification={() => setLastNotification(null)}
            />
          )}
          {activeTab === 'manage' && (
            <ManagePage
              keywords={keywords}
              onAdd={handleAddKeyword}
              onToggle={handleToggleKeyword}
              onDelete={handleDeleteKeyword}
              loading={loading}
              scanning={scanning}
              onScanningChange={setScanning}
            />
          )}
        </main>

        <NotificationToast
          notification={lastNotification}
          onDismiss={() => setLastNotification(null)}
        />

        {/* 底部状态栏 */}
        <footer className="flex-shrink-0 bg-dark-950/85 backdrop-blur-xl border-t border-white/[0.07] px-4 py-2 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.3)]">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] text-white/25 font-mono">
            <span className="flex items-center gap-2">
              <span className="text-indigo-400/50">◆</span>
              Hot Monitor
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`} />
              {connected ? '实时连接' : '未连接'}
            </span>
            <span className="text-white/10">{new Date().toLocaleDateString('zh-CN')}</span>
          </div>
        </footer>
      </div>
    </AnimatedGridBackground>
  );
}
