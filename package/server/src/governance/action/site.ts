import type { PolicyAction } from "@rezics/contract";

export const sitePolicyActions = {
  caseTriage: "case.triage",
  caseAssign: "case.assign",
  caseDecide: "case.decide",
  caseEscalate: "case.escalate",
  caseReverse: "case.reverse",
  queueDecide: "queue.site.decide",
  auditRead: "audit.read",
  staffConsoleAccess: "staff.console.access",
  repairRun: "operation.repair.run",
} as const satisfies Record<string, PolicyAction>;
