import { type ReactNode, useCallback, useEffect, useRef } from "react";
import { useFolio } from "../context";

interface PageContainerProps {
  children: ReactNode;
}

export function PageContainer({ children }: PageContainerProps) {
  const { state, dispatch } = useFolio();
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const containerWidth = container.clientWidth;
    if (containerWidth === 0) return;

    const count = Math.max(1, Math.round(inner.scrollWidth / containerWidth));
    dispatch({ type: "SET_PAGE_COUNT", count });
  }, [dispatch]);

  // Recalculate on mount and resize
  // 在挂载和尺寸变化时重新计算
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(recalculate);
    observer.observe(container);

    return () => observer.disconnect();
  }, [recalculate]);

  // Recalculate on font load
  // 在字体加载完成时重新计算
  useEffect(() => {
    document.fonts.ready.then(recalculate);
  }, [recalculate]);

  // Recalculate when content changes
  // 在内容变化时重新计算
  useEffect(() => {
    recalculate();
  }, [recalculate]);

  // Observe image loads within content
  // 监听内容中的图片加载
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const images = inner.querySelectorAll("img");
    const handlers: Array<() => void> = [];

    for (const img of images) {
      if (!img.complete) {
        const handler = () => recalculate();
        img.addEventListener("load", handler, { once: true });
        handlers.push(() => img.removeEventListener("load", handler));
      }
    }

    return () => {
      for (const cleanup of handlers) cleanup();
    };
  }, [recalculate]);

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const translateX = -(state.pageIndex * containerWidth);

  return (
    <div
      ref={containerRef}
      className="folio-page-container"
      style={{
        overflow: "hidden",
        height: "100%",
        position: "relative",
      }}
    >
      <div
        ref={innerRef}
        className="folio-page-inner"
        style={{
          columnWidth: containerWidth ? `${containerWidth}px` : "100vw",
          columnGap: 0,
          columnFill: "auto",
          height: "100%",
          transform: `translateX(${translateX}px)`,
          transition: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
