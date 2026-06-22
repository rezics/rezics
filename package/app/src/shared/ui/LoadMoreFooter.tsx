import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { cn } from "@/shared/utils/css-util";
import { useInfiniteScrollSentinel } from "../hooks/useInfiniteScrollSentinel";

interface LoadMoreFooterProps {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  showEndOfList?: boolean;
  /** Attach an IntersectionObserver sentinel to auto-load on scroll.
   * 附加 IntersectionObserver 哨兵实现滚动自动加载。 */
  autoLoad?: boolean;
  className?: string;
}

// ponytail: extracted from ~10 identical inline implementations;
// autoLoad adds IO sentinel so pages get auto-scroll for free
// ponytail: 从 ~10 个相同的内联实现中提取；
// autoLoad 添加 IO 哨兵使页面免费获得自动滚动加载
export function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  showEndOfList = false,
  autoLoad = false,
  className,
}: LoadMoreFooterProps) {
  const { t } = useTranslation(["common"]);
  const sentinelRef = useInfiniteScrollSentinel({
    hasNextPage: autoLoad ? hasNextPage : false,
    isFetchingNextPage,
    fetchNextPage,
  });

  if (hasNextPage) {
    return (
      <div
        ref={autoLoad ? sentinelRef : undefined}
        className={cn("flex justify-center", className)}
      >
        <Button
          type="button"
          variant="outline"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              {t("common:loading")}
            </span>
          ) : (
            t("common:load_more")
          )}
        </Button>
      </div>
    );
  }

  if (showEndOfList) {
    return (
      <p
        className={cn(
          "text-center text-xs leading-dense text-text-tertiary",
          className,
        )}
      >
        {t("common:end_of_list")}
      </p>
    );
  }

  return null;
}
