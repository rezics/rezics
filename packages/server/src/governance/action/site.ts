import type { PolicyAction } from "@rezics/contract";
import type { GovernanceActionDefinition } from "./registry";

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

export const siteActionDefinitions = [
  {
    action: sitePolicyActions.caseTriage,
    requiredCapability: "moderation.case.triage",
    family: "case",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.caseAssign,
    requiredCapability: "moderation.case.assign",
    family: "case",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.caseDecide,
    requiredCapability: "moderation.case.decide",
    family: "case",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.caseEscalate,
    requiredCapability: "moderation.case.escalate",
    family: "case",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.caseReverse,
    requiredCapability: "moderation.case.reverse",
    family: "case",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.queueDecide,
    requiredCapability: "queue.site.decide",
    family: "case",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.auditRead,
    requiredCapability: "audit.read",
    family: "audit",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.staffConsoleAccess,
    requiredCapability: "audit.read",
    family: "staff-console",
    staffOnly: true,
  },
  {
    action: sitePolicyActions.repairRun,
    requiredCapability: "audit.read",
    family: "operation",
    staffOnly: true,
  },
] as const satisfies readonly GovernanceActionDefinition[];
