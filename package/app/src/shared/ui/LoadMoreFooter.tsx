import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import clsx from "clsx";

interface LoadMoreFooterProps {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  showEndOfList?: boolean;
  className?: string;
}

// ponytail: extracted from ~10 identical inline implementations
export function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  showEndOfList = false,
  className,
}: LoadMoreFooterProps) {
  const { t } = useTranslation(["common"]);

  if (hasNextPage) {
    return (
      <div className={clsx("flex justify-center", className)}>
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
      <p className={clsx("text-center text-xs leading-dense text-text-tertiary", className)}>
        {t("common:end_of_list")}
      </p>
    );
  }

  return null;
}
