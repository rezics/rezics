import { type ReactNode, useCallback, useRef } from "react";
import { useFolio } from "../context";

interface ScrollContainerProps {
  children: ReactNode;
}

export function ScrollContainer({ children }: ScrollContainerProps) {
  const { dispatch } = useFolio();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    dispatch({ type: "SET_SCROLL_OFFSET", offset: el.scrollTop });
  }, [dispatch]);

  return (
    <div
      ref={scrollRef}
      className="folio-scroll-container"
      onScroll={handleScroll}
      style={{
        overflow: "auto",
        height: "100%",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
