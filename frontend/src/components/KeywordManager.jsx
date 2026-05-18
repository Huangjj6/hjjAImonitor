import { useState } from 'react';

export default function KeywordManager({ keywords = [], onAdd, onToggle, onDelete, loading }) {
  const [newKeyword, setNewKeyword] = useState('');
  const [category, setCategory] = useState('AI');

  const categories = ['AI', '编程', '科技', '商业', '安全', 'general'];

  const handleAdd = async () => {
    if (!newKeyword.trim()) return;
    await onAdd(newKeyword.trim(), category);
    setNewKeyword('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 添加区域 */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <span className="text-neon-cyan">⌨</span> 添加监控关键词
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入关键词，如：GPT-5、Gemini..."
              className="input-neon"
              disabled={loading}
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
            className="btn-neon whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '...' : '+ 添加'}
          </button>
        </div>
      </div>

      {/* 关键词列表 */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <span className="text-neon-green">📋</span> 监控列表
          <span className="text-xs text-gray-600 font-mono ml-auto">
            {keywords.filter(k => k.enabled).length}/{keywords.length} 启用中
          </span>
        </h3>

        {keywords.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <div className="text-4xl mb-3">🛰️</div>
            <p className="text-sm">还没有监控关键词</p>
            <p className="text-xs mt-1">添加关键词开始监控热点</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keywords.map((kw) => (
              <div
                key={kw.id}
                className={`flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${
                  kw.enabled
                    ? 'bg-dark-700/50 border border-neon-green/10'
                    : 'bg-dark-800/30 border border-transparent opacity-50'
                }`}
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
                    <div className="text-sm font-medium truncate">
                      {kw.enabled ? (
                        <span className="text-white">{kw.keyword}</span>
                      ) : (
                        <span className="text-gray-500 line-through">{kw.keyword}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="tag tag-source text-[10px]">{kw.category}</span>
                      <span className="text-[10px] text-gray-600 font-mono">
                        {kw.created_at?.split(' ')[0]}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDelete(kw.id)}
                  className="text-gray-600 hover:text-neon-pink transition-colors ml-3 flex-shrink-0 p-1"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
