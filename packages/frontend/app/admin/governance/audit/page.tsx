"use client";

import { getI18nRuntime } from "@rezics/i18n/runtime";
import { PlaceholderPage } from "@/admin/core/layouts/PlaceholderPage";

export default function GovernanceAuditPage() {
  return (
    <PlaceholderPage
      title={getI18nRuntime().i18n.t("admin:nav_governance_audit")}
    />
  );
}
