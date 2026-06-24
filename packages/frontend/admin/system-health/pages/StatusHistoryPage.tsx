import { getI18nRuntime } from "@rezics/i18n/runtime";
import { HistoryOutboxPanel } from "../components/StatusPanels";
import { StatusSubPageShell } from "../components/StatusSubPageShell";

export function StatusHistoryPage() {
  const { t } = getI18nRuntime().i18n;
  return (
    <StatusSubPageShell
      title={t("admin:status_history_title")}
      description={t("admin:status_history_description")}
    >
      {(summary) => (
        <HistoryOutboxPanel historyOutbox={summary.historyOutbox} />
      )}
    </StatusSubPageShell>
  );
}
