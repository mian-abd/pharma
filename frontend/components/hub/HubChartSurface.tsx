'use client';

import { useEffect, useRef, useState } from 'react';

type ChartSize = {
  width: number;
  height: number;
};

type Props = {
  minHeight?: number;
  className?: string;
  children: (size: ChartSize) => React.ReactNode;
};

export default function HubChartSurface({ minHeight = 120, className = '', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width));
      const height = Math.max(minHeight, Math.floor(rect.height));
      if (width >= 40 && height >= minHeight) {
        setSize({ width, height });
      }
    };

    updateSize();

    const frame = window.requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    window.addEventListener('resize', updateSize);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [minHeight]);

  return (
    <div ref={ref} className={className} style={{ minHeight }}>
      {size ? (
        children(size)
      ) : (
        <div className="h-full w-full rounded border border-border/50 bg-secondary/20 flex items-center justify-center">
          <div className="space-y-2 w-full max-w-[220px] px-4">
            <div className="h-2 rounded bg-secondary/70" />
            <div className="h-2 rounded bg-secondary/50 w-5/6" />
            <div className="h-2 rounded bg-secondary/30 w-2/3" />
          </div>
        </div>
      )}
    </div>
  );
}
