'use client';

import { cn } from '../../lib/utils';

/**
 * Aceternity-inspired glowing border effect.
 * Wraps children with a subtle animated border glow on hover.
 */
export function GlowingEffect({ children, className, containerClassName }) {
  return (
    <div className={cn('group relative', containerClassName)}>
      {/* Glow borders */}
      <div
        className={cn(
          'absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700',
          'bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-violet-500/20 blur-sm'
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          'absolute -inset-[2px] rounded-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500',
          'bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-violet-500/40 blur-[2px]'
        )}
        aria-hidden="true"
      />
      {/* Content */}
      <div className={cn('relative rounded-2xl', className)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Glowing stats card with animated left border accent.
 */
export function StatCard({ icon, label, value, sub, accent = 'emerald', className }) {
  const accents = {
    emerald: 'from-emerald-400 to-teal-500/20',
    cyan: 'from-cyan-400 to-sky-500/20',
    violet: 'from-violet-400 to-purple-500/20',
    amber: 'from-amber-400 to-orange-500/20',
    rose: 'from-rose-400 to-pink-500/20',
  };

  const hoverBorders = {
    emerald: 'hover:border-emerald-500/40',
    cyan: 'hover:border-cyan-500/40',
    violet: 'hover:border-violet-500/40',
    amber: 'hover:border-amber-500/40',
    rose: 'hover:border-rose-500/40',
  };

  const hoverGlows = {
    emerald: 'hover:shadow-[0_0_28px_rgba(16,185,129,0.15)]',
    cyan: 'hover:shadow-[0_0_28px_rgba(6,182,212,0.15)]',
    violet: 'hover:shadow-[0_0_28px_rgba(139,92,246,0.15)]',
    amber: 'hover:shadow-[0_0_28px_rgba(245,158,11,0.15)]',
    rose: 'hover:shadow-[0_0_28px_rgba(244,63,94,0.15)]',
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border transition-all duration-500',
        'bg-white/[0.05] border-white/[0.10] hover:bg-white/[0.08]',
        'shadow-[0_4px_16px_rgba(0,0,0,0.30)]',
        hoverBorders[accent] || 'hover:border-violet-500/40',
        hoverGlows[accent] || 'hover:shadow-[0_0_28px_rgba(139,92,246,0.15)]',
        'p-5',
        className
      )}
    >
      {/* Accent line */}
      <div
        className={cn(
          'absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-40 group-hover:opacity-90 transition-opacity duration-500',
          'bg-gradient-to-b',
          accents[accent] || 'from-violet-400'
        )}
        style={{
          backgroundImage: `linear-gradient(to bottom, var(--tw-gradient-from), transparent)`,
        }}
      />
      {/* Content */}
      <div className="relative pl-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
        </div>
        <div className="text-2xl font-bold text-white tracking-tight font-mono tabular-nums">
          {value}
        </div>
        <div className="text-[11px] text-white/55 mt-1 font-medium">{label}</div>
        {sub && (
          <div className="text-[10px] text-white/22 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
