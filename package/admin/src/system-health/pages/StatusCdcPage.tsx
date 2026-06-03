import { getI18nRuntime } from "@rezics/i18n/runtime";
import { CdcPanel } from "../components/StatusPanels";
import { StatusSubPageShell } from "../components/StatusSubPageShell";

export function StatusCdcPage() {
  const { t } = getI18nRuntime().i18n;
  return (
    <StatusSubPageShell
      title={t("admin:status_cdc_title")}
      description={t("admin:status_cdc_description")}
    >
      {(summary) => <CdcPanel cdc={summary.cdc} />}
    </StatusSubPageShell>
  );
}
