import { t } from "elysia";

export const capabilityKeys = [
  "account.warn",
  "account.silence",
  "account.suspend",
  "account.ban",
  "account.rate_limit",
  "moderation.case.triage",
  "moderation.case.assign",
  "moderation.case.decide",
  "moderation.case.escalate",
  "moderation.case.reverse",
  "queue.site.decide",
  "queue.realm.decide",
  "content.takedown",
  "content.lock",
  "content.archive",
  "content.restore",
  "tag.curate",
  "audit.read",
] as const;

export type Capability = (typeof capabilityKeys)[number];

export const capabilitySchema = t.Union(
  capabilityKeys.map((key) => t.Literal(key)) as [
    ReturnType<typeof t.Literal<Capability>>,
    ReturnType<typeof t.Literal<Capability>>,
    ...Array<ReturnType<typeof t.Literal<Capability>>>,
  ],
);

export const capabilityScopeKinds = ["global", "realm"] as const;
export type CapabilityScopeKind = (typeof capabilityScopeKinds)[number];

export const capabilityScopeKindSchema = t.Union([
  t.Literal("global"),
  t.Literal("realm"),
]);

export const capabilityScopeSchema = t.Object({
  kind: capabilityScopeKindSchema,
  realmUnitId: t.Optional(t.String()),
});

export type CapabilityScope = (typeof capabilityScopeSchema)["static"];

export const capabilityHintSchema = t.Object({
  capability: capabilitySchema,
  scope: capabilityScopeSchema,
  expiresAt: t.Optional(t.Nullable(t.String())),
});

export type CapabilityHint = (typeof capabilityHintSchema)["static"];
