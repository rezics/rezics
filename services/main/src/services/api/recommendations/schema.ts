import type { StaticDecode } from "typebox";
import { t } from "elysia";

import {
	RecommendationClientEventTypeValues,
	RecommendationReasonValues,
	RecommendationSurfaceValues,
} from "../../database/schema/contract-values";
import { DateTime, DisplayPosition, LocalizationLanguageHints, Uuid } from "../schema";
import { VariantUnitType } from "../units/schema";

export const RecommendationSurfaceSchema = t.UnionEnum(RecommendationSurfaceValues);
export type RecommendationSurface = StaticDecode<typeof RecommendationSurfaceSchema>;

export const RecommendationReasonSchema = t.UnionEnum(RecommendationReasonValues);
export type RecommendationReason = StaticDecode<typeof RecommendationReasonSchema>;

export const RecommendationPolicyVersionSchema = t.String({
	minLength: 1,
	maxLength: 64,
	pattern: "\\S",
});

export const RecommendationTrackingSchema = t.Object(
	{
		requestId: Uuid,
		surface: RecommendationSurfaceSchema,
		position: DisplayPosition,
		policyVersion: RecommendationPolicyVersionSchema,
		signature: t.String({
			minLength: 43,
			maxLength: 43,
			pattern: "^[A-Za-z0-9_-]{43}$",
		}),
	},
	{ additionalProperties: false },
);
export type RecommendationTracking = StaticDecode<typeof RecommendationTrackingSchema>;

export const RecommendationEventBatchBody = t.Object(
	{
		events: t.Array(
			t.Object(
				{
					id: Uuid,
					targetUnitId: Uuid,
					type: t.UnionEnum(RecommendationClientEventTypeValues),
					occurredAt: DateTime,
					...RecommendationTrackingSchema.properties,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 100 },
		),
	},
	{ additionalProperties: false },
);
export type RecommendationEventBatchBody = StaticDecode<typeof RecommendationEventBatchBody>;

export const RecommendationExclusionParams = t.Object({ unitId: Uuid });
export type RecommendationExclusionParams = StaticDecode<typeof RecommendationExclusionParams>;

export const RecommendationExclusionBody = t.Object(
	{
		eventId: Uuid,
		occurredAt: DateTime,
		...RecommendationTrackingSchema.properties,
	},
	{ additionalProperties: false },
);
export type RecommendationExclusionBody = StaticDecode<typeof RecommendationExclusionBody>;

export const UnitRecommendationQuery = t.Object({
	type: t.Optional(VariantUnitType),
	seedUnitId: t.Optional(Uuid),
	personalized: t.Optional(t.Boolean()),
	cursor: t.Optional(t.String({ maxLength: 1_024 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	localizationLanguages: t.Optional(LocalizationLanguageHints),
});
export type UnitRecommendationQuery = StaticDecode<typeof UnitRecommendationQuery>;

export const RelatedPostParams = t.Object({ postId: Uuid });
export type RelatedPostParams = StaticDecode<typeof RelatedPostParams>;

export const RelatedPostQuery = t.Object({
	personalized: t.Optional(t.Boolean()),
	cursor: t.Optional(t.String({ maxLength: 1_024 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 50, default: 20 })),
	localizationLanguages: t.Optional(LocalizationLanguageHints),
});
export type RelatedPostQuery = StaticDecode<typeof RelatedPostQuery>;

export const RecommendationEventBatchResponse = t.Object({ accepted: t.Integer() });
export const RecommendationExclusionResponse = t.Object({ excluded: t.Boolean() });

const RecommendationCoverResponse = t.Nullable(
	t.Object({
		id: Uuid,
		url: t.String(),
	}),
);

export const UnitRecommendationResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			type: VariantUnitType,
			language: t.Nullable(t.String()),
			contentRating: t.String(),
			publishedAt: t.Nullable(DateTime),
			createdAt: DateTime,
			updatedAt: DateTime,
			title: t.Nullable(t.String()),
			summary: t.Nullable(t.String()),
			cover: RecommendationCoverResponse,
			recommendationReason: t.Nullable(RecommendationReasonSchema),
			source: t.Nullable(t.UnionEnum(["direct", "main"])),
			tracking: RecommendationTrackingSchema,
		}),
	),
	nextCursor: t.Nullable(t.String()),
});
