import type { BookshelfViewConfig } from "@rezics/contract";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { BookCard } from "@/book-library";
import { useIsMobile } from "@/shared/utils/use-media-query";
import {
  aspectRatioForKind,
  columnsForWidth,
} from "../models/resolveBookshelfConfig";
import type { BookshelfItem } from "../models/types";
import { BookshelfHoverPanel } from "./BookshelfHoverPanel";

export interface BookshelfGridProps {
  items: readonly BookshelfItem[];
  config: BookshelfViewConfig;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Responsive cover grid for library items. Column count resolves from the
 * container width against the config breakpoints. On pointer devices a
 * hover preview panel appears; on touch devices tapping navigates to the
 * item detail (no preview).
 * 用于书库条目的响应式封面网格。列数根据容器宽度与 config 断点解析得出。
 * 在指针设备上会显示悬停预览面板；在触摸设备上点击会跳转到条目详情
 *（无预览）。
 */
export const BookshelfGrid: React.FC<BookshelfGridProps> = ({
  items,
  config,
  className,
  emptyState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isTouch = useIsMobile();
  const [columns, setColumns] = useState(
    () => config.breakpoints[0]?.columns ?? 1,
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setColumns(columnsForWidth(config, el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [config]);

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "1rem",
      }}
    >
      {items.map((item) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover only reveals a pointer preview; the nested BookCard remains the keyboard target.
        <div
          key={item.unitId}
          className="relative"
          onMouseEnter={isTouch ? undefined : () => setHoveredId(item.unitId)}
          onMouseLeave={isTouch ? undefined : () => setHoveredId(null)}
        >
          <BookCard
            title={item.title}
            author={item.author}
            coverUrl={item.coverUrl}
            href={item.href}
            showTitle={config.showTitle}
            aspectRatio={aspectRatioForKind(item.kind)}
          />
          {item.chaptersTotal != null && item.chaptersTotal > 0 ? (
            <div className="mt-1 text-xs tabular-nums text-text-secondary">
              {item.chaptersCompleted ?? 0}/{item.chaptersTotal}
            </div>
          ) : null}
          {!isTouch && hoveredId === item.unitId ? (
            <div className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2">
              <BookshelfHoverPanel item={item} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
};
