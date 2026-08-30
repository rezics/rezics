import type { StaticDecode } from "typebox";
import { t } from "elysia";

import { ReactionKindValues } from "../../database/schema/contract-values";
import { Uuid } from "../schema";

export const UnitReactionParams = t.Object({ unitId: Uuid });
export type UnitReactionParams = StaticDecode<typeof UnitReactionParams>;

export const ReactionContextQuery = t.Object({ realmId: t.Optional(Uuid) });
export type ReactionContextQuery = StaticDecode<typeof ReactionContextQuery>;

export const SetReactionBody = t.Object({
	reaction: t.Union(ReactionKindValues.map((value) => t.Literal(value))),
	realmId: t.Optional(Uuid),
});
export type SetReactionBody = StaticDecode<typeof SetReactionBody>;
