import { useEffect, useState } from 'react';
import type { ToolbarItem } from '../types';
import { useEditorContext } from '../../react/context';

export interface ReactToolbarProps {
  items: ToolbarItem[];
  className?: string;
}

export function ReactToolbar({ items, className }: ReactToolbarProps) {
  const view = useEditorContext();
  const [, forceUpdate] = useState<number>(0);

  useEffect(() => {
    if (!view) return;

    let raf: number;
    let lastDoc = view.state.doc.toString();
    let lastSel = view.state.selection.main.head;

    function check() {
      if (!view) return;
      const doc = view.state.doc.toString();
      const sel = view.state.selection.main.head;
      if (doc !== lastDoc || sel !== lastSel) {
        lastDoc = doc;
        lastSel = sel;
        forceUpdate((n) => n + 1);
      }
      raf = requestAnimationFrame(check);
    }

    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  if (!view) return null;

  return (
    <div
      role="toolbar"
      className={className}
      style={{ display: 'flex', gap: 2, padding: '4px 8px' }}
    >
      {items.map((item) => {
        const active = item.isActive?.(view.state) ?? false;
        return (
          <button
            key={item.name}
            type="button"
            title={item.label}
            onClick={() => {
              item.action(view);
              view.focus();
            }}
            style={{
              padding: '2px 8px',
              border: active ? '1px solid #ccc' : '1px solid transparent',
              borderRadius: 3,
              background: active ? '#e0e0e0' : 'none',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {item.icon ?? item.label}
          </button>
        );
      })}
    </div>
  );
}
