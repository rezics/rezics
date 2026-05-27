import type { PolicyAction } from "@rezics/contract";

export const realmPolicyActions = {
  queueDecide: "queue.realm.decide",
  memberRoleChange: "realm.member.role.change",
  memberCapabilityChange: "realm.member.capability.change",
  reportEscalate: "realm.report.escalate",
  tagCurate: "tag.curate",
} as const satisfies Record<string, PolicyAction>;
