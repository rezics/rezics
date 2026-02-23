import React, {useEffect, useMemo, useState} from 'react';
import {Typography, useTheme} from '@mui/material';
import type {CarouselApi} from '@/shadcn/carousel';
import {cn} from '@/shared/util/css-util';

export type CarouselIndicatorProps = {
  api: CarouselApi | null;
  position?: 'overlay' | 'bottom';
  align?: 'center' | 'left' | 'right';
  variant?: 'text' | 'dots';
  clickable?: boolean;
  className?: string;
};

export const CarouselIndicator: React.FC<CarouselIndicatorProps> = ({
  api,
  position = 'overlay',
  align = 'center',
  variant = 'dots',
  clickable = true,
  className,
}) => {
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const themeMode = useTheme().palette.mode;
  const isDark = useMemo(() => themeMode === 'dark', [themeMode]);

  useEffect(() => {
    if (!api) return;

    const update = () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
    };

    update();
    api.on('select', update);

    return () => {
      api.off('select', update);
    };
  }, [api]);

  const alignClass =
    align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : align === 'left'
        ? 'left-4'
        : 'right-4';

  const positionClass =
    position === 'overlay' ? 'absolute bottom-4' : 'relative mt-3';

  const handleSelect = (index: number) => {
    if (!api || !clickable) return;
    api.scrollTo(index);
  };

  return (
    <div className={cn(positionClass, alignClass, 'z-20', className)}>
      {variant === 'text' ? (
        <Typography
          variant="body2"
          className="bg-black/50 text-white px-3 py-1 rounded-full backdrop-blur"
        >
          {current + 1} / {count}
        </Typography>
      ) : (
        <div className="flex gap-2">
          {Array.from({length: count}).map((_, i) => {
            const active = i === current;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(i)}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-200',
                  clickable && 'cursor-pointer',
                  active
                    ? isDark
                      ? 'bg-white scale-110'
                      : 'bg-black scale-110'
                    : isDark
                      ? 'bg-white/40 hover:bg-white/70'
                      : 'bg-black/40 hover:bg-black/70',
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
