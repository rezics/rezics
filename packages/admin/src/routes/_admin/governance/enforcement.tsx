import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/core/layouts/PlaceholderPage";

function GovernanceEnforcementPage() {
  return (
    <PlaceholderPage
      title={getI18nRuntime().i18n.t("admin:nav_governance_enforcement")}
    />
  );
}

export const Route = createFileRoute("/_admin/governance/enforcement")({
  component: GovernanceEnforcementPage,
});
