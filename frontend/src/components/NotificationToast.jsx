import { useEffect, useState } from 'react';

export default function NotificationToast({ notification, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onDismiss?.(), 400);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  if (!notification || !visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm toast-enter">
      <div className="glass-card p-4 neon-border cursor-pointer"
           onClick={() => window.open(notification.url, '_blank')}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-neon-green/20 flex items-center justify-center flex-shrink-0">
            <span className="text-neon-green text-sm">🔔</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="tag tag-source text-[10px]">{notification.source}</span>
              {notification.score && (
                <span className="tag tag-score text-[10px]">
                  {Math.round(notification.score * 100)}%
                </span>
              )}
            </div>
            <p className="text-sm text-white font-medium line-clamp-2">{notification.title}</p>
            <p className="text-[10px] text-gray-500 mt-1.5">点击查看详情</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setVisible(false); onDismiss?.(); }}
            className="text-gray-600 hover:text-white flex-shrink-0"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
