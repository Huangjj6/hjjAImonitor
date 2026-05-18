import { useEffect, useState } from 'react';

export default function NotificationToast({ notification, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      setExiting(false);
      const timer = setTimeout(() => {
        setExiting(true);
        setTimeout(() => {
          setVisible(false);
          onDismiss?.();
        }, 350);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  if (!notification || !visible) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 max-w-sm ${exiting ? 'toast-exit' : 'toast-enter'}`}>
      <div
        className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-dark-800/96 backdrop-blur-xl cursor-pointer group shadow-[0_12px_48px_rgba(0,0,0,0.55)]"
        onClick={() => window.open(notification.url, '_blank')}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <span className="text-sm">🔔</span>
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              {/* Tags */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                  {notification.source}
                </span>
                {notification.score !== undefined && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                    {Math.round(notification.score * 100)}%
                  </span>
                )}
              </div>

              {/* Title */}
              <p className="text-[13px] text-white/85 font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors">
                {notification.title}
              </p>

              {/* CTA */}
              <p className="text-[10px] text-white/15 mt-2 group-hover:text-white/30 transition-colors">
                点击查看详情 →
              </p>
            </div>

            {/* Close */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExiting(true);
                setTimeout(() => { setVisible(false); onDismiss?.(); }, 350);
              }}
              className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/15 hover:text-white/60 hover:bg-white/[0.04] transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
