import { Spinner } from "@rezics/ui";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { MeiliSummaryPanel } from "@/system-health/components/StatusPanels";
import { useAdminMeiliStatusQuery } from "@/system-health/hooks/useAdminStatusQueries";

export function MeiliObservabilitySection() {
  const query = useAdminMeiliStatusQuery();

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Spinner size="sm" />
        <span>載入 Meili 觀測資料中</span>
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert>
        <AlertDescription className="text-error-text">
          無法讀取 Meili 狀態，請確認目前帳號權限與 Server 連線。
        </AlertDescription>
      </Alert>
    );
  }

  if (!query.data) {
    return <p className="text-sm text-text-secondary">尚無 Meili 狀態資料。</p>;
  }

  return <MeiliSummaryPanel meili={query.data} />;
}
