import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

const categories = ['AI', '编程', '科技', '商业', '安全', 'general'];
const categoryLabels = {
  'AI': 'AI',
  '编程': '编程',
  '科技': '科技',
  '商业': '商业',
  '安全': '安全',
  'general': '通用',
};
const categoryColors = {
  'AI': 'text-violet-300 bg-violet-500/15 border-violet-500/25',
  '编程': 'text-cyan-300 bg-cyan-500/15 border-cyan-500/25',
  '科技': 'text-sky-300 bg-sky-500/15 border-sky-500/25',
  '商业': 'text-amber-300 bg-amber-500/15 border-amber-500/25',
  '安全': 'text-rose-300 bg-rose-500/15 border-rose-500/25',
  'general': 'text-white/50 bg-white/8 border-white/12',
};

export default function CategoryDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = categories.find(c => c === value) || 'general';

  return (
    <div ref={ref} className="relative w-full sm:w-32">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-medium border transition-all duration-200',
          'bg-[#0d0d1a] border-white/[0.12] text-white/70 hover:border-indigo-500/40 hover:text-white/90',
          open && 'border-indigo-500/50 ring-1 ring-indigo-500/20'
        )}
      >
        <span>{categoryLabels[selected] || selected}</span>
        <svg
          className={cn('w-3.5 h-3.5 ml-2 transition-transform duration-200', open && 'rotate-180')}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 w-full min-w-[140px] rounded-xl border shadow-2xl',
            'bg-[#0d0d1a] border-white/[0.12]',
            'animate-fade-in'
          )}
          style={{ backdropFilter: 'none', background: '#0d0d1a' }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                onChange(cat);
                setOpen(false);
              }}
              className={cn(
                'flex items-center w-full px-3 py-2.5 text-[13px] transition-colors first:rounded-t-xl last:rounded-b-xl',
                cat === selected
                  ? 'text-white bg-indigo-500/10'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
              )}
            >
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border',
                categoryColors[cat] || categoryColors['general']
              )}>
                {categoryLabels[cat] || cat}
              </span>
              {cat === selected && (
                <svg className="w-3.5 h-3.5 ml-auto text-indigo-400" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
