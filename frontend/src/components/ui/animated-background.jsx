'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Aceternity-inspired animated dot grid background.
 * Renders a subtle grid of dots with gentle pulsing glow.
 */
export function AnimatedGridBackground({ className, children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let dots = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initDots();
    };

    const initDots = () => {
      const spacing = 80;
      const cols = Math.ceil(canvas.width / spacing);
      const rows = Math.ceil(canvas.height / spacing);
      dots = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          dots.push({
            x: x * spacing,
            y: y * spacing,
            baseX: x * spacing,
            baseY: y * spacing,
            phase: Math.random() * Math.PI * 2,
            speed: 0.2 + Math.random() * 0.5,
            radius: 0.5 + Math.random() * 0.6,
          });
        }
      }
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = time * 0.001;

      for (const dot of dots) {
        const pulse = Math.sin(t * dot.speed + dot.phase) * 0.5 + 0.5;
        const alpha = 0.05 + pulse * 0.10;
        const glowAlpha = pulse * 0.03;

        // Glow
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 140, 255, ${glowAlpha})`;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 255, ${alpha})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
