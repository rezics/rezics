import { useCallback, useEffect, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { StateEffect } from '@codemirror/state';
import type { ToolbarItem, ToolbarEntry } from '../types';
import { useEditorContext } from '../../react/context';

export interface ReactToolbarProps {
  items: ToolbarEntry[];
  className?: string;
}

/**
 * Hook that subscribes to CodeMirror state changes via an updateListener
 * extension, re-rendering only when the document or selection changes.
 */
function useEditorUpdate(view: EditorView | null) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!view) return;

    let active = true;
    view.dispatch({
      effects: StateEffect.appendConfig.of(
        EditorView.updateListener.of((update) => {
          if (active && (update.docChanged || update.selectionSet)) {
            setTick((n) => n + 1);
          }
        }),
      ),
    });

    return () => {
      active = false;
    };
  }, [view]);
}

const TOOLTIP_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginTop: 4,
  padding: '2px 6px',
  fontSize: 11,
  lineHeight: '16px',
  whiteSpace: 'nowrap',
  color: '#fff',
  background: '#333',
  borderRadius: 3,
  pointerEvents: 'none',
  opacity: 0,
  transition: 'opacity 0.12s',
};

const TOOLTIP_VISIBLE_STYLE: React.CSSProperties = {
  ...TOOLTIP_STYLE,
  opacity: 1,
};

function ToolbarButton({
  item,
  active,
  onClick,
}: {
  item: ToolbarItem;
  active: boolean;
  onClick: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const show = useCallback(() => setShowTooltip(true), []);
  const hide = useCallback(() => setShowTooltip(false), []);
  const handleClick = useCallback(() => {
    hide();
    onClick();
  }, [hide, onClick]);

  return (
    <button
      type="button"
      aria-label={item.label}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={handleClick}
      style={{
        position: 'relative',
        padding: '2px 8px',
        border: active ? '1px solid #ccc' : '1px solid transparent',
        borderRadius: 3,
        background: active ? '#e0e0e0' : 'none',
        cursor: 'pointer',
        fontSize: 13,
      }}
    >
      {item.icon ?? item.label}
      <span role="tooltip" style={showTooltip ? TOOLTIP_VISIBLE_STYLE : TOOLTIP_STYLE}>
        {item.label}
      </span>
    </button>
  );
}

function ToolbarSeparatorEl() {
  return (
    <div
      role="separator"
      style={{
        width: 1,
        alignSelf: 'stretch',
        margin: '4px 4px',
        background: '#d0d7de',
      }}
    />
  );
}

export function ReactToolbar({ items, className }: ReactToolbarProps) {
  const view = useEditorContext();
  useEditorUpdate(view);

  if (!view) return null;

  return (
    <div
      role="toolbar"
      className={className}
      style={{ display: 'flex', gap: 2, padding: '4px 8px', alignItems: 'center' }}
    >
      {items.map((entry, i) => {
        if (entry === '|') {
          return <ToolbarSeparatorEl key={`sep-${i}`} />;
        }
        const active = entry.isActive?.(view.state) ?? false;
        return (
          <ToolbarButton
            key={entry.name}
            item={entry}
            active={active}
            onClick={() => {
              entry.action(view);
              view.focus();
            }}
          />
        );
      })}
    </div>
  );
}
