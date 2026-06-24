import type { PolicyAction } from "@rezics/contract";
import type { GovernanceActionDefinition } from "./registry";

export const realmPolicyActions = {
  create: "realm.create",
  rulesUpdate: "realm.rules.update",
  queueDecide: "queue.realm.decide",
  memberRoleChange: "realm.member.role.change",
  memberCapabilityChange: "realm.member.capability.change",
  memberModerate: "realm.member.moderate",
  reportEscalate: "realm.report.escalate",
  zoneManage: "zone.manage",
  dmSend: "dm.send",
  contentPin: "content.pin",
  tagVote: "tag.vote",
  tagCurate: "tag.curate",
  tagPolicyRuleManage: "tag.policy.rule.manage",
  tagPolicyApplicationManage: "tag.policy.application.manage",
} as const satisfies Record<string, PolicyAction>;

export const realmActionDefinitions = [
  {
    action: realmPolicyActions.create,
    family: "realm",
  },
  {
    action: realmPolicyActions.rulesUpdate,
    requiredCapability: "queue.realm.decide",
    family: "realm",
    realmScoped: true,
  },
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
    action: realmPolicyActions.memberModerate,
    requiredCapability: "realm.member.moderate",
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
    action: realmPolicyActions.zoneManage,
    requiredCapability: "queue.realm.decide",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.dmSend,
    family: "realm",
  },
  {
    action: realmPolicyActions.contentPin,
    requiredCapability: "content.pin",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.tagVote,
    family: "realm",
  },
  {
    action: realmPolicyActions.tagCurate,
    requiredCapability: "tag.curate",
    family: "realm",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.tagPolicyRuleManage,
    requiredCapability: "tag.curate",
    family: "tag",
    realmScoped: true,
  },
  {
    action: realmPolicyActions.tagPolicyApplicationManage,
    requiredCapability: "tag.curate",
    family: "tag",
    realmScoped: true,
  },
] as const satisfies readonly GovernanceActionDefinition[];
