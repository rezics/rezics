import { t } from "elysia";
import { activeAccountEnforcementSummarySchema } from "../governance";
import { capabilityHintSchema } from "./capability";
import { policyDecisionSchema } from "./decision";
import { policyActionSchema } from "./action";
import { realmMemberRoleSchema } from "./realm-role";

export const policyTargetRefSchema = t.Object({
  kind: t.String(),
  id: t.String(),
  ownerUserId: t.Optional(t.Nullable(t.String())),
  realmUnitId: t.Optional(t.Nullable(t.String())),
});

export type PolicyTargetRef = (typeof policyTargetRefSchema)["static"];

export const policyInputSchema = t.Object({
  actorUserId: t.String(),
  action: policyActionSchema,
  capabilities: t.Array(capabilityHintSchema),
  activeEnforcement: t.Optional(
    t.Nullable(activeAccountEnforcementSummarySchema),
  ),
  realmMembership: t.Optional(
    t.Nullable(
      t.Object({
        realmUnitId: t.String(),
        role: realmMemberRoleSchema,
        capabilities: t.Array(capabilityHintSchema),
      }),
    ),
  ),
  target: t.Optional(t.Nullable(policyTargetRefSchema)),
  context: t.Optional(t.Record(t.String(), t.Unknown())),
});

export type PolicyInput = (typeof policyInputSchema)["static"];

export { policyDecisionSchema };
export type { PolicyDecision } from "./decision";
