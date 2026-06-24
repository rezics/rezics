import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/admin/core/layouts/PlaceholderPage";

function GovernanceAuditPage() {
  return (
    <PlaceholderPage
      title={getI18nRuntime().i18n.t("admin:nav_governance_audit")}
    />
  );
}

export const Route = createFileRoute("/_admin/governance/audit")({
  component: GovernanceAuditPage,
});
