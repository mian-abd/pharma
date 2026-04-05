'use client';

export default function HubLayerFrame({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`h-full min-h-0 overflow-hidden transition-all duration-300 ${
        active ? 'opacity-100' : 'opacity-[0.17] grayscale pointer-events-none blur-[0.2px]'
      }`}
    >
      {children}
    </div>
  );
}
