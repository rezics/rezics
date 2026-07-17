import { type Static, t } from "elysia";

import { PollModeValues, PollResultVisibilityValues } from "../../database/schema/contract-values";
import { LanguageTag, Uuid } from "../schema";

export const CreatePollBody = t.Object({
	question: t.String({ minLength: 1, maxLength: 500 }),
	language: LanguageTag,
	options: t.Array(t.String({ minLength: 1, maxLength: 500 }), {
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
