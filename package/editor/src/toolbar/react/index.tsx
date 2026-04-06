import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useState } from "react";
import { useEditorContext } from "../../react/context";
import type { ToolbarEntry, ToolbarItem } from "../types";
import "./toolbar.css";

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
      className="editor-toolbar-btn"
      data-active={active}
      aria-label={item.label}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={handleClick}
    >
      {item.icon ?? item.label}
      <span
        role="tooltip"
        className="editor-toolbar-tooltip"
        data-visible={showTooltip}
      >
        {item.label}
      </span>
    </button>
  );
}

function ToolbarSeparatorEl() {
  return <div role="separator" className="editor-toolbar-separator" />;
}

export function ReactToolbar({ items, className }: ReactToolbarProps) {
  const view = useEditorContext();
  useEditorUpdate(view);

  if (!view) return null;

  return (
    <div
      role="toolbar"
      className={`editor-toolbar${className ? ` ${className}` : ""}`}
    >
      {items.map((entry, i) => {
        if (entry === "|") {
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
