import type {
  GovernanceAuditListQuery,
  GovernanceListQuery,
} from "./governance.api";

export const governanceKeys = {
  all: () => ["governance"] as const,
  capabilityHints: () => [...governanceKeys.all(), "capability-hints"] as const,
  policyDecision: (input: unknown) =>
    [...governanceKeys.all(), "policy-decision", input] as const,
  enforcement: () => [...governanceKeys.all(), "enforcement"] as const,
  enforcementActive: (targetUserId: string) =>
    [...governanceKeys.enforcement(), "active", targetUserId] as const,
  enforcementList: (targetUserId: string, query?: GovernanceListQuery) =>
    [...governanceKeys.enforcement(), "list", targetUserId, query] as const,
  cases: () => [...governanceKeys.all(), "cases"] as const,
  caseList: (query?: GovernanceListQuery) =>
    [...governanceKeys.cases(), "list", query] as const,
  caseDetail: (caseId: string) =>
    [...governanceKeys.cases(), "detail", caseId] as const,
  caseEvents: (caseId: string, query?: GovernanceListQuery) =>
    [...governanceKeys.caseDetail(caseId), "events", query] as const,
  realmQueue: (realmUnitId: string) =>
    [...governanceKeys.all(), "realms", realmUnitId, "queue"] as const,
  realmQueueList: (realmUnitId: string, query?: GovernanceListQuery) =>
    [...governanceKeys.realmQueue(realmUnitId), "list", query] as const,
  realmQueueEvents: (
    realmUnitId: string,
    queueItemId: string,
    query?: GovernanceListQuery,
  ) =>
    [
      ...governanceKeys.realmQueue(realmUnitId),
      "detail",
      queueItemId,
      "events",
      query,
    ] as const,
  contentModeration: (targetUnitId: string) =>
    [...governanceKeys.all(), "content", targetUnitId, "moderation"] as const,
  realmContent: (realmUnitId: string, targetUnitId: string) =>
    [
      ...governanceKeys.all(),
      "realms",
      realmUnitId,
      "content",
      targetUnitId,
    ] as const,
  realmContentModeration: (realmUnitId: string, targetUnitId: string) =>
    [
      ...governanceKeys.realmContent(realmUnitId, targetUnitId),
      "moderation",
    ] as const,
  audit: () => [...governanceKeys.all(), "audit"] as const,
  auditList: (query?: GovernanceAuditListQuery) =>
    [...governanceKeys.audit(), "list", query] as const,
  auditDetail: (auditLogId: string) =>
    [...governanceKeys.audit(), "detail", auditLogId] as const,
} as const;
