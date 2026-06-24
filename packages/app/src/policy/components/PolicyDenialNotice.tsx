import type { DecisionCode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { TriangleAlert } from "lucide-react";
import type React from "react";
import type { PolicyDenial } from "../models/policyDenial";

export interface PolicyDenialNoticeProps {
  denial: PolicyDenial | null;
  className?: string;
}

/**
 * Inline denial banner for forms. Renders nothing when there is no denial,
 * so callers can mount it unconditionally next to the submit affordance and
 * pass the result of `policyDenialFromError(mutation.error)`.
 * 用于表单的内联拒绝横幅。当没有拒绝时不渲染任何内容，因此调用方可以无条件地
 * 将其挂载在提交控件旁边，并传入 `policyDenialFromError(mutation.error)` 的结果。
 */
export const PolicyDenialNotice: React.FC<PolicyDenialNoticeProps> = ({
  denial,
  className,
}) => {
  const { t } = useTranslation(["common"]);
  if (!denial) return null;

  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-border-error bg-error-container px-3 py-2 text-sm text-error-text${
        className ? ` ${className}` : ""
      }`}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{t("common:policy_denied_title")}</span>
        <span>{denialMessage(t, denial.code)}</span>
      </div>
    </div>
  );
};

/** Localized copy per decision code. Literal `t` calls keep R12 satisfied. 按 decision code 提供的本地化文案。字面量 `t` 调用以满足 R12。 */
function denialMessage(t: (key: string) => string, code: DecisionCode): string {
  switch (code) {
    case "MISSING_CAPABILITY":
    case "INSUFFICIENT_ROLE":
    case "OWNERSHIP_REQUIRED":
      return t("common:policy_denied_missing_capability");
    case "ENFORCEMENT_ACTIVE":
      return t("common:policy_denied_enforcement_active");
    case "BLOCKED_ACCOUNT":
      return t("common:policy_denied_blocked_account");
    case "RATE_LIMITED":
      return t("common:policy_denied_rate_limited");
    default:
      return t("common:policy_denied_generic");
  }
}
