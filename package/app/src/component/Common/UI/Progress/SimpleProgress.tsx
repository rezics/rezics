import React from 'react';

export function SimpleProgress({progress}: {progress: number}) {
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-1.5 md:h-2">
      <div
        className="h-full origin-left transition-transform duration-200
          bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300
          dark:from-blue-300 dark:via-sky-200 dark:to-cyan-100
          shadow-[0_0_8px_2px_rgba(0,150,255,0.4)]
        "
        style={{
          transform: `scaleX(${progress})`,
        }}
      />
    </div>
  );
}
