import type { StaticDecode } from "typebox";
import { t } from "elysia";

import { PollModeValues, PollResultVisibilityValues } from "../../database/schema/contract-values";
import { ContentLanguage, LocalizationLanguageQuery, RevisionContext, Uuid } from "../schema";

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
export type PollOptionInput = StaticDecode<typeof PollOptionInput>;

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
	revisionContext: t.Optional(RevisionContext),
});
export type CreatePollBody = StaticDecode<typeof CreatePollBody>;

export const ClosePollBody = t.Object(
	{ revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);
export type ClosePollBody = StaticDecode<typeof ClosePollBody>;

export const PollParams = t.Object({ pollId: Uuid });
export type PollParams = StaticDecode<typeof PollParams>;

export const PollDetailQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type PollDetailQuery = StaticDecode<typeof PollDetailQuery>;

export const VotePollBody = t.Object({
	optionIds: t.Array(Uuid, { minItems: 1, maxItems: 50 }),
	realmId: t.Optional(Uuid),
});
export type VotePollBody = StaticDecode<typeof VotePollBody>;
