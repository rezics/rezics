import type { SystemStatusSummary } from "@rezics/api";
import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription, Button } from "@rezics/ui/shadcn";
import { RefreshCw } from "lucide-react";
import type React from "react";
import { Page } from "@/core/layouts/Page";
import { useAdminSystemStatusQuery } from "../hooks/useAdminStatusQueries";

/**
 * Shared chrome for the focused `/status/*` sub-pages: title/description, the
 * refresh action, and the loading/error fallback. Each sub-page supplies only
 * its own copy and the panel to render once the shared status summary resolves,
 * so they all read from the same `useAdminSystemStatusQuery`.
 */
export function StatusSubPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: (summary: SystemStatusSummary) => React.ReactNode;
}) {
  const query = useAdminSystemStatusQuery();
  const summary = query.data;

  return (
    <Page
      title={title}
      description={description}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          重新整理
        </Button>
      }
    >
      {summary ? (
        children(summary)
      ) : query.isError ? (
        <Alert>
          <AlertDescription className="text-error-text">
            無法讀取狀態資料，請確認目前帳號權限與 Server 連線。
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner size="sm" />
          <span>載入狀態資料中</span>
        </div>
      )}
    </Page>
  );
}
