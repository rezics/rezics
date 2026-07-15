import { type Static, t } from "elysia";

import { ReactionKindValues } from "../../database/schema/contract-values";
import { Uuid } from "../schema";

export const UnitReactionParams = t.Object({ unitId: Uuid });
export type UnitReactionParams = Static<typeof UnitReactionParams>;

export const ReactionContextQuery = t.Object({ realmId: t.Optional(Uuid) });
export type ReactionContextQuery = Static<typeof ReactionContextQuery>;

export const SetReactionBody = t.Object({
	reaction: t.Union(ReactionKindValues.map((value) => t.Literal(value))),
	realmId: t.Optional(Uuid),
});
export type SetReactionBody = Static<typeof SetReactionBody>;
