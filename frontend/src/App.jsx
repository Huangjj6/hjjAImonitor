import { useState, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import KeywordManager from './components/KeywordManager';
import SettingsPage from './pages/SettingsPage';
import NotificationToast from './components/NotificationToast';
import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [keywords, setKeywords] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const { connected, lastNotification, setLastNotification } = useWebSocket();
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

  const handleAddKeyword = async (keyword, category) => {
    const res = await post('/keywords', { keyword, category });
    if (res.success) {
      await loadKeywords();
      return res.data;
    }
    throw new Error(res.error);
  };

  const handleToggleKeyword = async (id, enabled) => {
    await put(`/keywords/${id}`, { enabled });
    await loadKeywords();
  };

  const handleDeleteKeyword = async (id) => {
    await del(`/keywords/${id}`);
    await loadKeywords();
  };

  return (
    <div className="min-h-screen bg-dark-900 bg-grid">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'dashboard') setNotificationCount(0);
        }}
        connected={connected}
        notificationCount={notificationCount}
      />

      <main className="max-w-6xl mx-auto px-4 pt-20 pb-12">
        {activeTab === 'dashboard' && (
          <Dashboard
            notification={lastNotification}
            onDismissNotification={() => setLastNotification(null)}
          />
        )}
        {activeTab === 'keywords' && (
          <KeywordManager
            keywords={keywords}
            onAdd={handleAddKeyword}
            onToggle={handleToggleKeyword}
            onDelete={handleDeleteKeyword}
            loading={loading}
          />
        )}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <NotificationToast
        notification={lastNotification}
        onDismiss={() => setLastNotification(null)}
      />

      {/* 底部状态栏 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-900/90 backdrop-blur-md border-t border-dark-600 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] text-gray-600 font-mono">
          <span>Hot Monitor v1.0</span>
          <span>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${connected ? 'bg-neon-green' : 'bg-red-500'}`} />
            {connected ? 'WS Connected' : 'WS Disconnected'}
          </span>
          <span>{new Date().toLocaleDateString('zh-CN')}</span>
        </div>
      </footer>
    </div>
  );
}
