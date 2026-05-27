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
  },
  {
    action: sitePolicyActions.caseAssign,
    requiredCapability: "moderation.case.assign",
    family: "case",
  },
  {
    action: sitePolicyActions.caseDecide,
    requiredCapability: "moderation.case.decide",
    family: "case",
  },
  {
    action: sitePolicyActions.caseEscalate,
    requiredCapability: "moderation.case.escalate",
    family: "case",
  },
  {
    action: sitePolicyActions.caseReverse,
    requiredCapability: "moderation.case.reverse",
    family: "case",
  },
  {
    action: sitePolicyActions.queueDecide,
    requiredCapability: "queue.site.decide",
    family: "case",
  },
  {
    action: sitePolicyActions.auditRead,
    requiredCapability: "audit.read",
    family: "audit",
  },
  {
    action: sitePolicyActions.staffConsoleAccess,
    requiredCapability: "audit.read",
    family: "staff-console",
  },
  {
    action: sitePolicyActions.repairRun,
    requiredCapability: "audit.read",
    family: "operation",
  },
] as const satisfies readonly GovernanceActionDefinition[];
