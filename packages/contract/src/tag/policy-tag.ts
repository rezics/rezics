import { t } from "elysia";
import { paginationLimitSchema } from "../pagination";

export const policyTagScopeSchema = t.Union([
  t.Object(
    {
      kind: t.Literal("global"),
    },
    { additionalProperties: false },
  ),
  t.Object(
    {
      kind: t.Literal("realm"),
      realmUnitId: t.String(),
    },
    { additionalProperties: false },
  ),
]);

export type PolicyTagScope = (typeof policyTagScopeSchema)["static"];

export const policyTagRuleStateValues = ["active", "archived"] as const;
export type PolicyTagRuleState = (typeof policyTagRuleStateValues)[number];

export const policyTagRuleStateSchema = t.Union([
  t.Literal("active"),
  t.Literal("archived"),
]);

export const policyTagAuthoritySchema = t.Object(
  {
    ruleManageAction: t.Literal("tag.policy.rule.manage"),
    applicationManageAction: t.Literal("tag.policy.application.manage"),
    requiredCapability: t.Literal("tag.curate"),
  },
  { additionalProperties: false },
);

export type PolicyTagAuthority = (typeof policyTagAuthoritySchema)["static"];

export const policyTagRuleDTOSchema = t.Object(
  {
    id: t.String(),
    scope: policyTagScopeSchema,
    tagUnitId: t.String(),
    state: policyTagRuleStateSchema,
    authority: policyTagAuthoritySchema,
    createdByUserId: t.String(),
    updatedByUserId: t.Optional(t.Nullable(t.String())),
    reason: t.Optional(t.Nullable(t.String())),
    createdAt: t.Union([t.String(), t.Date()]),
    updatedAt: t.Union([t.String(), t.Date()]),
  },
  { additionalProperties: false },
);

export type PolicyTagRuleDTO = (typeof policyTagRuleDTOSchema)["static"];

export const createPolicyTagRuleSchema = t.Object(
  {
    scope: policyTagScopeSchema,
    tagUnitId: t.String(),
    reason: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type CreatePolicyTagRuleInput =
  (typeof createPolicyTagRuleSchema)["static"];

export const updatePolicyTagRuleSchema = t.Object(
  {
    state: t.Optional(policyTagRuleStateSchema),
    reason: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: false },
);

export type UpdatePolicyTagRuleInput =
  (typeof updatePolicyTagRuleSchema)["static"];

export const policyTagRuleListQuerySchema = t.Object({
  scopeKind: t.Optional(t.Union([t.Literal("global"), t.Literal("realm")])),
  realmUnitId: t.Optional(t.String()),
  tagUnitId: t.Optional(t.String()),
  state: t.Optional(policyTagRuleStateSchema),
  limit: paginationLimitSchema,
  offset: t.Optional(t.Numeric()),
});

export type PolicyTagRuleListQuery =
  (typeof policyTagRuleListQuerySchema)["static"];

export const policyTagRuleListResponseSchema = t.Object({
  rules: t.Array(policyTagRuleDTOSchema),
  total: t.Number(),
});

export type PolicyTagRuleListResponse =
  (typeof policyTagRuleListResponseSchema)["static"];

export const policyTagRulePathParamsSchema = t.Object({
  ruleId: t.String(),
});

export type PolicyTagRulePathParams =
  (typeof policyTagRulePathParamsSchema)["static"];

export const policyTagApplicationDTOSchema = t.Object(
  {
    id: t.String(),
    ruleId: t.String(),
    scope: policyTagScopeSchema,
    tagUnitId: t.String(),
    unitId: t.String(),
    position: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(t.Nullable(t.Record(t.String(), t.Unknown()))),
    appliedByUserId: t.String(),
    updatedByUserId: t.Optional(t.Nullable(t.String())),
    createdAt: t.Union([t.String(), t.Date()]),
    updatedAt: t.Union([t.String(), t.Date()]),
  },
  { additionalProperties: false },
);

export type PolicyTagApplicationDTO =
  (typeof policyTagApplicationDTOSchema)["static"];

export const createPolicyTagApplicationSchema = t.Object(
  {
    unitId: t.String(),
    position: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(t.Nullable(t.Record(t.String(), t.Unknown()))),
  },
  { additionalProperties: false },
);

export type CreatePolicyTagApplicationInput =
  (typeof createPolicyTagApplicationSchema)["static"];

export const patchPolicyTagApplicationSchema = t.Object(
  {
    position: t.Optional(t.Nullable(t.String())),
    metadata: t.Optional(t.Nullable(t.Record(t.String(), t.Unknown()))),
  },
  { additionalProperties: false },
);

export type PatchPolicyTagApplicationInput =
  (typeof patchPolicyTagApplicationSchema)["static"];

export const policyTagApplicationPathParamsSchema = t.Object({
  ruleId: t.String(),
  unitId: t.String(),
});

export type PolicyTagApplicationPathParams =
  (typeof policyTagApplicationPathParamsSchema)["static"];

export const policyTagApplicationListQuerySchema = t.Object({
  ruleId: t.Optional(t.String()),
  scopeKind: t.Optional(t.Union([t.Literal("global"), t.Literal("realm")])),
  realmUnitId: t.Optional(t.String()),
  tagUnitId: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  limit: paginationLimitSchema,
  offset: t.Optional(t.Numeric()),
});

export type PolicyTagApplicationListQuery =
  (typeof policyTagApplicationListQuerySchema)["static"];

export const policyTagApplicationListResponseSchema = t.Object({
  applications: t.Array(policyTagApplicationDTOSchema),
  total: t.Number(),
});

export type PolicyTagApplicationListResponse =
  (typeof policyTagApplicationListResponseSchema)["static"];
