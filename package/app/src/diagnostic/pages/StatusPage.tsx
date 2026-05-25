import { Activity, RefreshCw } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { MainContentContainer } from "@/core/components/container/MainContentContainer";
import { useSystemStatusData } from "../hooks/useStatusData";
import { describeStatusState } from "../models/status";
import {
  CdcStatusPanel,
  DatabaseStatusPanel,
  MeiliStatusPanel,
  QueueStatusPanel,
  StatusLinksPanel,
  StatusServiceGrid,
} from "../components/StatusPanels";
import { StatusIndicator } from "../components/StatusIndicator";

export function StatusPage() {
  const query = useSystemStatusData();

  if (query.isLoading) {
    return (
      <MainContentContainer width="wide" className="py-8">
        <Helmet>
          <title>系統狀態 · rezics</title>
        </Helmet>
        <div className="flex items-center gap-3 rounded-md bg-surface-elevated p-4 text-sm leading-[1.55] text-text-secondary">
          <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
          正在讀取系統狀態
        </div>
      </MainContentContainer>
    );
  }

  if (query.isError || !query.data) {
    return (
      <MainContentContainer width="wide" className="py-8">
        <Helmet>
          <title>系統狀態 · rezics</title>
        </Helmet>
        <div className="rounded-md bg-surface-elevated p-6">
          <h1 className="text-lg font-medium leading-[1.4] text-text-primary">
            系統狀態暫時無法讀取
          </h1>
          <p className="mt-2 text-sm leading-[1.55] text-text-secondary">
            請確認目前帳號具備管理權限，且 Rezics Server 可正常回應狀態 API。
          </p>
        </div>
      </MainContentContainer>
    );
  }

  const data = query.data;

  return (
    <MainContentContainer width="wide" className="py-8">
      <Helmet>
        <title>系統狀態 · rezics</title>
      </Helmet>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm leading-[1.4] text-text-secondary">
            <Activity aria-hidden="true" className="h-4 w-4" />
            Internal diagnostics
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-[1.3] text-text-primary">
            系統狀態
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-[1.55] text-text-secondary">
            {describeStatusState(data.status)}。最後檢查：
            {new Date(data.checkedAt).toLocaleString("zh-TW")}
          </p>
        </div>
        <StatusIndicator status={data.status} />
      </div>

      <div className="space-y-8">
        <StatusLinksPanel links={data.links} />
        <StatusServiceGrid services={data.services} />
        <MeiliStatusPanel meili={data.meili} />
        <CdcStatusPanel cdc={data.cdc} />
        <DatabaseStatusPanel databases={data.databases} />
        <QueueStatusPanel queue={data.queue} />
      </div>
    </MainContentContainer>
  );
}
