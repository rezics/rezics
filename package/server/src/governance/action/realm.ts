import type { PolicyAction } from "@rezics/contract";
import type { GovernanceActionDefinition } from "./registry";

export const realmPolicyActions = {
  queueDecide: "queue.realm.decide",
  memberRoleChange: "realm.member.role.change",
  memberCapabilityChange: "realm.member.capability.change",
  reportEscalate: "realm.report.escalate",
  tagCurate: "tag.curate",
} as const satisfies Record<string, PolicyAction>;

export const realmActionDefinitions = [
  {
    action: realmPolicyActions.queueDecide,
    requiredCapability: "queue.realm.decide",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.memberRoleChange,
    requiredCapability: "queue.realm.decide",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.memberCapabilityChange,
    requiredCapability: "queue.realm.decide",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.reportEscalate,
    requiredCapability: "moderation.case.escalate",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.tagCurate,
    requiredCapability: "tag.curate",
    family: "realm",
    realmScoped: true,
  },
] as const satisfies readonly GovernanceActionDefinition[];
