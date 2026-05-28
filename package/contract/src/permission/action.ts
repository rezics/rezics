import { t } from "elysia";

export const policyActionKeys = [
  "account.warn",
  "account.silence",
  "account.suspend",
  "account.ban",
  "account.unblock",
  "account.rate_limit",
  "case.triage",
  "case.assign",
  "case.decide",
  "case.escalate",
  "case.reverse",
  "queue.site.decide",
  "queue.realm.decide",
  "content.create",
  "content.delete",
  "content.pin",
  "content.takedown",
  "content.lock",
  "content.archive",
  "content.restore",
  "realm.create",
  "realm.member.role.change",
  "realm.member.capability.change",
  "realm.report.escalate",
  "dm.send",
  "reaction.create",
  "tag.vote",
  "tag.curate",
  "audit.read",
  "staff.console.access",
  "operation.repair.run",
] as const;

export type PolicyAction = (typeof policyActionKeys)[number];

export const policyActionSchema = t.Union(
  policyActionKeys.map((key) => t.Literal(key)) as [
    ReturnType<typeof t.Literal<PolicyAction>>,
    ReturnType<typeof t.Literal<PolicyAction>>,
    ...Array<ReturnType<typeof t.Literal<PolicyAction>>>,
  ],
);
