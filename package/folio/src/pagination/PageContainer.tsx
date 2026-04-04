import {
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useFolio } from '../context';

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
    dispatch({ type: 'SET_PAGE_COUNT', count });
  }, [dispatch]);

  // Recalculate on mount and resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(recalculate);
    observer.observe(container);

    return () => observer.disconnect();
  }, [recalculate]);

  // Recalculate on font load
  useEffect(() => {
    document.fonts.ready.then(recalculate);
  }, [recalculate]);

  // Recalculate when content changes
  useEffect(() => {
    recalculate();
  }, [children, recalculate]);

  // Observe image loads within content
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const images = inner.querySelectorAll('img');
    const handlers: Array<() => void> = [];

    for (const img of images) {
      if (!img.complete) {
        const handler = () => recalculate();
        img.addEventListener('load', handler, { once: true });
        handlers.push(() => img.removeEventListener('load', handler));
      }
    }

    return () => handlers.forEach((cleanup) => cleanup());
  }, [children, recalculate]);

  const containerWidth = containerRef.current?.clientWidth ?? 0;
  const translateX = -(state.pageIndex * containerWidth);

  return (
    <div
      ref={containerRef}
      className="folio-page-container"
      style={{
        overflow: 'hidden',
        height: '100%',
        position: 'relative',
      }}
    >
      <div
        ref={innerRef}
        className="folio-page-inner"
        style={{
          columnWidth: containerWidth ? `${containerWidth}px` : '100vw',
          columnGap: 0,
          columnFill: 'auto',
          height: '100%',
          transform: `translateX(${translateX}px)`,
          transition: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

