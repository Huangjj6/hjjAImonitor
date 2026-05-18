import { useState } from 'react';
import { cn } from '../lib/utils';

export default function KeywordManager({ keywords = [], onAdd, onToggle, onDelete, loading }) {
  const [newKeyword, setNewKeyword] = useState('');
  const [category, setCategory] = useState('AI');
  const [focused, setFocused] = useState(false);

  const categories = ['AI', '编程', '科技', '商业', '安全', 'general'];

  const categoryColors = {
    'AI': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    '编程': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    '科技': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    '商业': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    '安全': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'general': 'bg-white/5 text-gray-400 border-white/10',
  };

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    await onAdd(newKeyword.trim(), category);
    setNewKeyword('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  const enabledCount = keywords.filter(k => k.enabled).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 添加区域 */}
      <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
            <span className="text-xs text-cyan-400">⌨</span>
          </div>
          <h3 className="text-sm font-semibold text-white/70">添加监控关键词</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="输入关键词，如：GPT-5、Gemini..."
              className="input-neon"
              disabled={loading}
            />
            {/* Focus glow */}
            <div
              className={cn(
                'absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300',
                'bg-gradient-to-r from-indigo-500/5 via-cyan-500/5 to-transparent',
                focused ? 'opacity-100' : 'opacity-0'
              )}
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-neon w-full sm:w-32"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={loading || !newKeyword.trim()}
            className="btn-neon btn-neon-primary whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? '...' : '+ 添加'}
          </button>
        </div>
      </div>

      {/* 关键词列表 */}
      <div className="rounded-2xl border border-white/[0.04] bg-white/[0.01] backdrop-blur-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <span className="text-xs text-emerald-400">📋</span>
          </div>
          <h3 className="text-sm font-semibold text-white/70">监控列表</h3>
          <span className="text-[11px] text-white/15 font-mono ml-auto">
            {enabledCount}/{keywords.length} 启用中
          </span>
        </div>

        {keywords.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
              <span className="text-3xl opacity-20">🛰️</span>
            </div>
            <p className="text-sm text-white/20">还没有监控关键词</p>
            <p className="text-xs text-white/10 mt-1">添加关键词开始监控热点</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keywords.map((kw, i) => (
              <div
                key={kw.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl transition-all duration-300 border group',
                  kw.enabled
                    ? 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.03]'
                    : 'bg-transparent border-transparent opacity-40 hover:opacity-60'
                )}
                style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
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
                      'text-sm font-medium truncate transition-colors',
                      kw.enabled ? 'text-white/85' : 'text-white/20 line-through'
                    )}>
                      {kw.keyword}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border',
                        categoryColors[kw.category] || categoryColors['general']
                      )}>
                        {kw.category}
                      </span>
                      <span className="text-[10px] text-white/10 font-mono">
                        {kw.created_at?.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(kw.id)}
                  className="text-white/10 hover:text-rose-400 transition-colors ml-3 flex-shrink-0 p-1.5 rounded-lg hover:bg-rose-500/5 opacity-0 group-hover:opacity-100"
                  title="删除"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
