import { useEffect, useRef } from "react";

interface UseInfiniteScrollSentinelOptions {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  rootMargin?: string;
}

// ponytail: thin wrapper around IntersectionObserver for infinite-scroll
// sentinel pattern; attach the returned ref to a DOM element near the list end
// ponytail: IntersectionObserver 的薄封装，用于无限滚动哨兵模式；
// 将返回的 ref 附加到列表末尾附近的 DOM 元素
export function useInfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootMargin = "240px",
}: UseInfiniteScrollSentinelOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fetchNextPage();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rootMargin]);

  return sentinelRef;
}
