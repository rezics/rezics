import { useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription, AlertTitle } from "@rezics/ui/shadcn";
import type {
  ZoneManageIssue,
  ZoneManageJsonProblemsByKey,
} from "../../models/zoneManageDraft";

const ISSUE_KEYS = {
  section_id_duplicate: "zone:manage_issue_section_id_duplicate",
  tab_id_duplicate: "zone:manage_issue_tab_id_duplicate",
  tab_default_invalid: "zone:manage_issue_tab_default_invalid",
  query_field_unsupported: "zone:manage_issue_query_field_unsupported",
  dynamic_tags_target_unsupported:
    "zone:manage_issue_dynamic_tags_target_unsupported",
  dynamic_tags_probability_invalid:
    "zone:manage_issue_dynamic_tags_probability_invalid",
  menu_id_duplicate: "zone:manage_issue_menu_id_duplicate",
  menu_too_deep: "zone:manage_issue_menu_too_deep",
  menu_leaf_missing_target: "zone:manage_issue_menu_leaf_missing_target",
  menu_group_missing_label: "zone:manage_issue_menu_group_missing_label",
  header_menu_invalid: "zone:manage_issue_header_menu_invalid",
} as const satisfies Record<ZoneManageIssue["code"], `zone:${string}`>;

function issueParams(issue: ZoneManageIssue): Record<string, string> {
  const { code: _code, ...rest } = issue;
  return Object.fromEntries(
    Object.entries(rest).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : String(value),
    ]),
  );
}

/**
 * Shared validation notices for zone management pages. Each alert occupies the
 * full content width and appears above the editor that owns the invalid draft.
 *
 * Zone 管理页共享校验提示：每个提示占满内容宽度，并显示在持有无效 draft 的
 * 编辑器上方。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Alert title              │
 * │ • problem                │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Alert with wrapped problem list    │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Alert full width inside manage container   │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │ Centered max-width inherited from layout   │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageProblemNotices({
  issues,
  jsonProblemsByKey,
}: {
  issues: readonly ZoneManageIssue[];
  jsonProblemsByKey: ZoneManageJsonProblemsByKey;
}) {
  const { t } = useTranslation(["zone"]);
  const hasJsonProblems = Object.values(jsonProblemsByKey).some(
    (problems) => problems.length > 0,
  );

  return (
    <>
      {issues.length > 0 ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{t("zone:manage_issues")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {issues.map((issue, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: display list
                  key={index}
                >
                  {t(ISSUE_KEYS[issue.code], issueParams(issue))}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {hasJsonProblems ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>{t("zone:manage_json_invalid")}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {Object.entries(jsonProblemsByKey).flatMap(([key, problems]) =>
                problems.map((problem) => (
                  <li key={`${key}:${problem}`}>{problem}</li>
                )),
              )}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}
