import type {ReactNode} from 'react';
import {cn} from '@/shared/lib/utils';

export interface EditorPanelProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function EditorPanel({left, right, className}: EditorPanelProps) {
  return (
    <div className={cn('flex items-center gap-2 px-2 py-1.5', className)}>
      {left && <div className="flex items-center gap-1">{left}</div>}
      <div className="flex-1" />
      {right && <div className="flex items-center gap-1">{right}</div>}
    </div>
  );
}
