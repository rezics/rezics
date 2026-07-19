import { PortableTextDocument } from "@rezics/block";
import { type Static, t } from "elysia";

import {
	FeedbackKindValues,
	GovernanceReasonCodeValues,
} from "../../database/schema/contract-values";
import { DateTime, LanguageTag, Uuid } from "../schema";

const FeedbackType = t.Union(FeedbackKindValues.map((value) => t.Literal(value)));

export const CreateFeedbackBody = t.Object(
	{
		type: FeedbackType,
		language: LanguageTag,
		content: PortableTextDocument,
		url: t.Optional(t.String({ format: "uri", maxLength: 2_000 })),
		subjectUnitId: t.Optional(Uuid),
		realmId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export type CreateFeedbackBody = Static<typeof CreateFeedbackBody>;

export const ListFeedbackQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
});
export type ListFeedbackQuery = Static<typeof ListFeedbackQuery>;

const FeedbackNoteResponse = t.Object({
	postId: Uuid,
	revisionId: Uuid,
	language: LanguageTag,
	content: PortableTextDocument,
});

export const FeedbackResponse = t.Object({
	id: Uuid,
	type: t.String(),
	evidence: FeedbackNoteResponse,
	url: t.Nullable(t.String()),
	subjectUnitId: t.Nullable(Uuid),
	status: t.String(),
	resolutionCode: t.Nullable(t.UnionEnum(GovernanceReasonCodeValues, { default: undefined })),
	publicNotice: t.Nullable(FeedbackNoteResponse),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const FeedbackListResponse = t.Object({ items: t.Array(FeedbackResponse) });
