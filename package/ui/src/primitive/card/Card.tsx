import React from 'react';

export function ShadowRoundedCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-rose-200 p-8 shadow-2xl shadow-rose-500/10">
        {children}
      </div>
    </div>
  );
}
