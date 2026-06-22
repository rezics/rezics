import {
  governanceAuditListQuery,
  governanceRealmCaseListQuery,
  useDecideRealmCaseMutation,
} from "@rezics/api/governance/governance";
import type { ModerationCaseDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ClipboardList,
  FileClock,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { toast } from "sonner";
import { QueryErrorDisplay } from "@/core";

/**
 * Moderation dashboard showing realm-specific cases, metrics, and audit trail.
 * Displays 4 metric cards (Reports, Cases, Sanctions, Audit), case list with actions,
 * and recent audit entries. Managers can approve/remove reported content.
 *
 * 显示社区特定案件、指标和审计日志的审核仪表板。
 * 显示4个指标卡(报告、案件、制裁、审计)、带操作的案件列表和最近的审计条目。
 * 管理员可以批准/删除报告的内容。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ [Shield] Moderation      │
 * ├──────────────────────────┤
 * │ [Metric 1]               │
 * │ [Metric 2]               │
 * │ [Metric 3]               │
 * │ [Metric 4]               │
 * ├──────────────────────────┤
 * │ Realm Cases              │
 * │ [Case 1 - with action]   │
 * │ [Case 2 - with action]   │
 * ├──────────────────────────┤
 * │ Recent Audit             │
 * │ [Audit 1] [Audit 2]      │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ [Shield] Moderation                │
 * ├────────────────────────────────────┤
 * │ [Metric 1] [Metric 2]              │
 * │ [Metric 3] [Metric 4]              │
 * ├────────────────────────────────────┤
 * │ Realm Cases                        │
 * │ [Case 1 - with action]             │
 * │ [Case 2 - with action]             │
 * ├────────────────────────────────────┤
 * │ Recent Audit                       │
 * │ [Audit 1] [Audit 2]                │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ [Shield] Moderation                  │
 * ├──────────────────────────────────────┤
 * │ [M1] [M2] [M3] [M4]                 │
 * ├──────────────────────────────────────┤
 * │ Realm Cases                          │
 * │ [Case 1]          [Case 2]           │
 * │ [Case 3]          [Case 4]           │
 * ├──────────────────────────────────────┤
 * │ Recent Audit                         │
 * │ [Audit 1]         [Audit 2]          │
 * │ [Audit 3]         [Audit 4]          │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────┐
 * │ [Shield] Moderation                    │
 * ├────────────────────────────────────────┤
 * │ [M1] [M2] [M3] [M4]                   │
 * ├────────────────────────────────────────┤
 * │ Realm Cases                            │
 * │ [Case 1] [Case 2] [Case 3] [Case 4]    │
 * ├────────────────────────────────────────┤
 * │ Recent Audit                           │
 * │ [Audit 1]   [Audit 2]   [Audit 3]      │
 * └────────────────────────────────────────┘
 */
interface RealmModerationQueueSectionProps {
  realmUnitId: string;
}

export function RealmModerationQueueSection({
  realmUnitId,
}: RealmModerationQueueSectionProps) {
  const { t } = useTranslation(["community", "common"]);
  const casesQuery = useQuery(
    governanceRealmCaseListQuery(realmUnitId, { limit: 25 }),
  );
  const auditQuery = useQuery(
    governanceAuditListQuery({
      targetKind: "realm",
      targetId: realmUnitId,
      limit: 6,
    }),
  );

  const cases = casesQuery.data ?? [];
  const openCases = cases.filter(
    (item) => item.state !== "resolved" && item.state !== "rejected",
  );
  const linkedCases = new Set(
    cases
      .map((item) => item.parentCaseId)
      .filter((caseId): caseId is string => Boolean(caseId)),
  );
  const subjectUserIds = cases
    .map((item) => item.subjectUserId)
    .filter((userId): userId is string => Boolean(userId));
  const firstSubjectUserId = subjectUserIds[0];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-text-tertiary" aria-hidden />
        <h2 className="text-base font-semibold leading-ui text-text-primary">
          {t("community:moderation_title")}
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={ClipboardList}
          title={t("community:moderation_reports")}
          value={String(openCases.length)}
          detail={t("community:moderation_reports_detail")}
        >
          <Link to="/staff" search={{ realmUnitId, accountUserId: undefined }}>
            <Button variant="outline" size="sm">
              {t("community:moderation_staff_cases")}
            </Button>
          </Link>
        </MetricCard>
        <MetricCard
          icon={Scale}
          title={t("community:moderation_cases")}
          value={String(linkedCases.size)}
          detail={t("community:moderation_cases_detail")}
        >
          {Array.from(linkedCases)
            .slice(0, 1)
            .map((caseId) => (
              <Link key={caseId} to="/staff/case/$caseId" params={{ caseId }}>
                <Button variant="outline" size="sm">
                  {t("community:moderation_open_case")}
                </Button>
              </Link>
            ))}
        </MetricCard>
        <MetricCard
          icon={UserRoundCheck}
          title={t("community:moderation_sanctions")}
          value={String(new Set(subjectUserIds).size)}
          detail={t("community:moderation_sanctions_detail")}
        >
          {firstSubjectUserId ? (
            <Link
              to="/staff/account/$targetUserId"
              params={{ targetUserId: firstSubjectUserId }}
            >
              <Button variant="outline" size="sm">
                {t("community:moderation_account_safety")}
              </Button>
            </Link>
          ) : null}
        </MetricCard>
        <MetricCard
          icon={FileClock}
          title={t("community:moderation_audit")}
          value={
            auditQuery.isLoading ? "..." : String(auditQuery.data?.length ?? 0)
          }
          detail={t("community:moderation_audit_detail")}
        >
          <Link
            to="/staff/audit"
            search={{ targetKind: "realm", targetId: realmUnitId }}
          >
            <Button variant="outline" size="sm">
              {t("community:moderation_audit_view")}
            </Button>
          </Link>
        </MetricCard>
      </div>
      <Card surface="contained">
        <CardHeader>
          <CardTitle>{t("community:moderation_realm_cases")}</CardTitle>
        </CardHeader>
        <CardContent>
          {casesQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : casesQuery.isError ? (
            <QueryErrorDisplay error={casesQuery.error} />
          ) : cases.length ? (
            <div className="grid gap-3">
              {cases.map((item) => (
                <RealmCaseCard
                  key={item.id}
                  item={item}
                  realmUnitId={realmUnitId}
                />
              ))}
            </div>
          ) : (
            <EmptyState title={t("community:moderation_no_realm_cases")} />
          )}
        </CardContent>
      </Card>
      {auditQuery.isError ? (
        <div className="rounded-md bg-error-fill/10 p-4 text-sm leading-body text-error-text">
          {t("community:moderation_audit_error")}
        </div>
      ) : auditQuery.data?.length ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-text-tertiary" aria-hidden />
            <h3 className="text-base font-semibold leading-ui text-text-primary">
              {t("community:moderation_recent_audit")}
            </h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {auditQuery.data.map((entry) => (
              <Card key={entry.id} surface="plain">
                <CardContent className="p-4">
                  <div className="text-sm font-medium leading-ui text-text-primary">
                    {entry.action}
                  </div>
                  <p className="mt-1 text-xs leading-ui text-text-tertiary">
                    {formatDate(entry.createdAt)}
                  </p>
                  <p className="mt-2 text-sm leading-body text-text-secondary">
                    {entry.reason}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function caseStateVariant(state: string) {
  if (state === "new" || state === "triaged") return "secondary";
  if (state === "resolved" || state === "actioned") return "default";
  return "outline";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function RealmCaseCard({
  item,
  realmUnitId,
}: {
  item: ModerationCaseDTO;
  realmUnitId: string;
}) {
  const { t } = useTranslation(["community", "common"]);
  const summary =
    item.reason ?? item.safeSummary ?? t("community:moderation_no_summary");
  const updatedAt = formatDate(item.updatedAt);
  const decideCase = useDecideRealmCaseMutation({
    onSuccess: () => toast.success(t("community:moderation_case_updated")),
  });
  const isPendingReview = item.target.kind === "unit" && item.state === "new";
  const decide = (actionKind: "approve" | "remove", reason: string) =>
    decideCase.mutate({
      realmUnitId,
      caseId: item.id,
      input: { actionKind, reason },
    });

  return (
    <Card surface="plain">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={caseStateVariant(item.state)}>{item.state}</Badge>
          <span className="text-sm font-medium leading-ui text-text-primary">
            {item.target.kind}:{item.target.id}
          </span>
          {item.parentCaseId ? (
            <Badge variant="outline">
              {t("community:moderation_case_linked")}
            </Badge>
          ) : null}
        </div>
        <p className="m-0 text-sm leading-body text-text-secondary">
          {summary}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-ui text-text-tertiary">
          {item.subjectUserId ? (
            <Link
              to="/staff/account/$targetUserId"
              params={{ targetUserId: item.subjectUserId }}
              className="underline-offset-2 hover:text-text-primary hover:underline"
            >
              {t("community:moderation_subject", { id: item.subjectUserId })}
            </Link>
          ) : null}
          {item.assignedToUserId ? (
            <span>
              {t("community:moderation_assigned", {
                id: item.assignedToUserId,
              })}
            </span>
          ) : null}
          {updatedAt ? (
            <span>
              {t("community:moderation_updated", { date: updatedAt })}
            </span>
          ) : null}
        </div>
        {isPendingReview || item.parentCaseId ? (
          <div className="flex flex-wrap gap-2">
            {isPendingReview ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  disabled={decideCase.isPending}
                  onClick={() => decide("approve", "approved_for_realm")}
                >
                  {t("common:approve")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={decideCase.isPending}
                  onClick={() => decide("remove", "removed_from_realm")}
                >
                  {t("common:remove")}
                </Button>
              </>
            ) : null}
            {item.parentCaseId ? (
              <Link
                to="/staff/case/$caseId"
                params={{ caseId: item.parentCaseId }}
              >
                <Button variant="outline" size="sm">
                  {t("community:moderation_open_case")}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  detail,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <Card surface="contained">
      <CardContent className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase leading-ui text-text-tertiary">
              {title}
            </div>
            <div className="mt-2 text-2xl font-semibold leading-ui text-text-primary">
              {value}
            </div>
          </div>
          <Icon className="h-5 w-5 text-text-tertiary" aria-hidden />
        </div>
        <p className="m-0 flex-1 text-sm leading-body text-text-secondary">
          {detail}
        </p>
        {children ? (
          <div className="flex flex-wrap gap-2">{children}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
