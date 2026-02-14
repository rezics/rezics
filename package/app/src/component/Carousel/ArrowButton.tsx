import React from 'react';
import type {SvgIconComponent} from '@mui/icons-material';
import {useAppStore} from '@/global/appStore';
import clsx from 'clsx';

export interface ArrowButtonProps {
  icon: SvgIconComponent;
  onClick?: () => void;
  className?: string;
}

export const ArrowButton: React.FC<ArrowButtonProps> = ({
  icon: Icon,
  onClick,
  className,
}) => {
  const isDark = useAppStore(s => s.theme) === 'dark';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'group inline-flex items-center justify-center',
        'h-10 w-10 rounded-full p-0',
        'select-none backdrop-blur-md',
        'transition-[transform,background-color,box-shadow] duration-200 ease-out',
        'hover:shadow-lg active:shadow-md',
        'hover:scale-[1.06] active:scale-[0.98]',
        'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        isDark
          ? 'bg-white/10 text-white hover:bg-white/16 active:bg-white/20 focus-visible:ring-white/30 shadow-black/40'
          : 'bg-black/5 text-black hover:bg-black/10 active:bg-black/14 focus-visible:ring-black/20 shadow-black/15',
        className,
      )}
      aria-label="arrow"
    >
      <Icon fontSize="inherit" className="pointer-events-none" />
    </button>
  );
};
