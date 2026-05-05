import { useCallback, useMemo, useState } from "react";
import { useFolio } from "../context";
import type { TocEntry } from "./buildToc";

const DEPTH_COLORS: Record<string, Record<number, string>> = {
  light: {
    0: "rgba(0, 0, 0, 0.08)",
    1: "rgba(0, 0, 0, 0.04)",
    2: "rgba(0, 0, 0, 0.02)",
  },
  dark: {
    0: "rgba(255, 255, 255, 0.12)",
    1: "rgba(255, 255, 255, 0.06)",
    2: "rgba(255, 255, 255, 0.03)",
  },
  sepia: {
    0: "rgba(139, 90, 43, 0.12)",
    1: "rgba(139, 90, 43, 0.06)",
    2: "rgba(139, 90, 43, 0.03)",
  },
};

function getDepthBg(theme: string, depth: number): string {
  const themeColors = DEPTH_COLORS[theme] ?? DEPTH_COLORS.light;
  return themeColors[Math.min(depth, 2)] ?? themeColors[2];
}

export function TocPanel() {
  const { state, dispatch, flatChapters, tree } = useFolio();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const allBranchIds = useMemo(() => {
    const ids: string[] = [];
    function walk(nodes: typeof tree) {
      for (const node of nodes) {
        if (node.children) {
          ids.push(node.id);
          walk(node.children);
        }
      }
    }
    walk(tree);
    return ids;
  }, [tree]);

  const toggleBranch = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(
    () => setCollapsed(new Set(allBranchIds)),
    [allBranchIds],
  );

  const visibleEntries = useMemo(() => {
    const visible: TocEntry[] = [];

    function walkVisible(nodes: typeof tree, depth: number) {
      for (const node of nodes) {
        if (node.children) {
          visible.push({ kind: "branch", node, depth });
          if (!collapsed.has(node.id) && node.children) {
            walkVisible(node.children, depth + 1);
          }
        } else {
          const chapter = flatChapters.find((f) => f.node.id === node.id);
          if (chapter) {
            visible.push({ kind: "leaf", node, chapter });
          }
        }
      }
    }

    walkVisible(tree, 0);
    return visible;
  }, [tree, flatChapters, collapsed]);

  return (
    <div className="folio-toc" style={{ overflow: "auto", height: "100%" }}>
      <div
        className="folio-toc-controls"
        style={{
          display: "flex",
          gap: "8px",
          padding: "var(--padding-toolbar-y) 12px",
          borderBottom: "1px solid var(--colors-border-whisper)",
        }}
      >
        <button
          type="button"
          onClick={expandAll}
          style={{ fontSize: "12px", cursor: "pointer" }}
        >
          Expand All
        </button>
        <button
          type="button"
          onClick={collapseAll}
          style={{ fontSize: "12px", cursor: "pointer" }}
        >
          Collapse All
        </button>
      </div>

      <div className="folio-toc-list">
        {visibleEntries.map((entry) => {
          if (entry.kind === "branch") {
            const isCollapsed = collapsed.has(entry.node.id);
            return (
              <button
                type="button"
                key={`branch-${entry.node.id}`}
                className="folio-toc-branch"
                onClick={() => toggleBranch(entry.node.id)}
                style={{
                  padding: "var(--padding-list-item-y) 12px",
                  background: getDepthBg(state.theme, entry.depth),
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px",
                  userSelect: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  color: "inherit",
                  font: "inherit",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 0,
                    height: 0,
                    borderTop: "4px solid transparent",
                    borderBottom: "4px solid transparent",
                    borderLeft: "5px solid currentColor",
                    transform: isCollapsed ? undefined : "rotate(90deg)",
                    transition: "transform 120ms ease-out",
                  }}
                />
                {entry.node.title}
              </button>
            );
          }

          const isActive = entry.chapter.index === state.chapterIndex;
          return (
            <button
              type="button"
              key={`leaf-${entry.node.id}`}
              className="folio-toc-leaf"
              onClick={() =>
                dispatch({ type: "SET_CHAPTER", index: entry.chapter.index })
              }
              style={{
                padding: "var(--padding-list-item-y) 12px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                background: isActive
                  ? "rgba(59, 130, 246, 0.1)"
                  : "transparent",
                borderLeft: isActive
                  ? "3px solid rgb(59, 130, 246)"
                  : "3px solid transparent",
                userSelect: "none",
                border: "none",
                width: "100%",
                textAlign: "left",
                color: "inherit",
                font: "inherit",
              }}
            >
              {entry.node.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
