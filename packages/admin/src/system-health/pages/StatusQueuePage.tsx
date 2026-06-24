import { getI18nRuntime } from "@rezics/i18n/runtime";
import { QueuePanel } from "../components/StatusPanels";
import { StatusSubPageShell } from "../components/StatusSubPageShell";

export function StatusQueuePage() {
  const { t } = getI18nRuntime().i18n;
  return (
    <StatusSubPageShell
      title={t("admin:status_queue_title")}
      description={t("admin:status_queue_description")}
    >
      {(summary) => <QueuePanel queue={summary.queue} />}
    </StatusSubPageShell>
  );
}
