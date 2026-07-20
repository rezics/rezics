import { type Static, t } from "elysia";

import { PollModeValues, PollResultVisibilityValues } from "../../database/schema/contract-values";
import { ContentLanguage, Uuid } from "../schema";

const PollOptionLabel = t.String({ minLength: 1, maxLength: 500 });

export const PollOptionInput = t.Union([
	t.Object(
		{
			sourceKind: t.Literal("literal"),
			label: PollOptionLabel,
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			sourceKind: t.Literal("unit"),
			targetUnitId: Uuid,
			label: PollOptionLabel,
		},
		{ additionalProperties: false },
	),
]);
export type PollOptionInput = Static<typeof PollOptionInput>;

export const CreatePollBody = t.Object({
	question: t.String({ minLength: 1, maxLength: 500 }),
	language: ContentLanguage,
	options: t.Array(PollOptionInput, {
		minItems: 2,
		maxItems: 50,
	}),
	voteMode: t.Union(PollModeValues.map((value) => t.Literal(value))),
	anonymous: t.Optional(t.Boolean({ default: false })),
	resultsVisibility: t.Union(PollResultVisibilityValues.map((value) => t.Literal(value))),
	closesAt: t.Optional(t.String({ format: "date-time" })),
});
export type CreatePollBody = Static<typeof CreatePollBody>;

export const PollParams = t.Object({ pollId: Uuid });
export type PollParams = Static<typeof PollParams>;

export const VotePollBody = t.Object({
	optionIds: t.Array(Uuid, { minItems: 1, maxItems: 50 }),
	realmId: t.Optional(Uuid),
});
export type VotePollBody = Static<typeof VotePollBody>;
