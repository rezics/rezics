import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";

interface BookDetailLayoutContextValue {
  setSidebar: (node: ReactNode) => void;
}

export const BookDetailLayoutContext =
  createContext<BookDetailLayoutContextValue | null>(null);

/**
 * Pages call this to populate the sidebar slot owned by `BookDetailLayout`.
 * Memoize the node (e.g. `useMemo`) so identity only changes when its data
 * does — otherwise every render schedules a layout state update.
 */
export function useBookDetailSidebar(node: ReactNode): void {
  const ctx = useContext(BookDetailLayoutContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setSidebar(node);
    return () => ctx.setSidebar(null);
  }, [ctx, node]);
}
