import { getI18nRuntime } from "@rezics/i18n/runtime";
import { ServicesPanel } from "../components/StatusPanels";
import { StatusSubPageShell } from "../components/StatusSubPageShell";

export function StatusServicesPage() {
  const { t } = getI18nRuntime().i18n;
  return (
    <StatusSubPageShell
      title={t("admin:status_services_title")}
      description={t("admin:status_services_description")}
    >
      {(summary) => (
        <ServicesPanel
          services={summary.services}
          databases={summary.databases}
          sequin={summary.sequin}
        />
      )}
    </StatusSubPageShell>
  );
}
