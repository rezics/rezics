import { t } from "elysia";

import { ZoneThemeRevisionStateValues } from "../../database/schema/contract-values";
import {
	ContentLanguage,
	DateTime,
	RevisionContext,
	UnitLocalizationContentFields,
	UnitLocalizationInput,
	Uuid,
} from "../schema";

export const MaximumZoneThemeAssets = 16;
export const ZoneThemeReferenceBreakpoints = [375, 768, 1280] as const;
export const ZoneThemeReferenceColorSchemes = ["light", "dark"] as const;

export const CreateZoneThemeBody = t.Object(
	{ localization: UnitLocalizationInput },
	{ additionalProperties: false },
);

export const ZoneThemeParams = t.Object({ themeUnitId: Uuid });
export const ZoneThemeRevisionParams = t.Object({ themeUnitId: Uuid, revisionId: Uuid });
export const ZoneThemeLocalizationParams = t.Object({
	themeUnitId: Uuid,
	language: ContentLanguage,
});
export const ZoneThemeLocalizationBody = t.Object(
	{ ...UnitLocalizationContentFields, revisionContext: t.Optional(RevisionContext) },
	{ additionalProperties: false },
);

export const SubmitZoneThemeRevisionBody = t.Object(
	{
		css: t.String({ maxLength: 65_536 }),
		assetIds: t.Array(Uuid, {
			maxItems: MaximumZoneThemeAssets,
			uniqueItems: true,
			default: [],
		}),
	},
	{ additionalProperties: false },
);

const AutomatedStaticReview = t.Object(
	{
		contractVersion: t.String(),
		declarationCount: t.Integer({ minimum: 0 }),
		minifiedBytes: t.Integer({ minimum: 0, maximum: 65_536 }),
		ruleCount: t.Integer({ minimum: 0 }),
		selectorCount: t.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

export const CompleteZoneThemeAutomatedReviewBody = t.Object(
	{
		renderReview: t.Object(
			{
				captures: t.Array(
					t.Object(
						{
							breakpoint: t.Union([t.Literal(375), t.Literal(768), t.Literal(1280)]),
							colorScheme: t.UnionEnum(ZoneThemeReferenceColorSchemes),
							screenshotAssetId: Uuid,
							layoutShift: t.Number({ minimum: 0 }),
							contrastViolations: t.Integer({ minimum: 0 }),
						},
						{ additionalProperties: false },
					),
					{ minItems: 6, maxItems: 6 },
				),
			},
			{ additionalProperties: false },
		),
		aiReview: t.Object(
			{
				model: t.String({ minLength: 1, maxLength: 200 }),
				passed: t.Boolean(),
				findings: t.Array(t.String({ minLength: 1, maxLength: 1_000 }), { maxItems: 64 }),
			},
			{ additionalProperties: false },
		),
	},
	{ additionalProperties: false },
);

export const DecideZoneThemeRevisionBody = t.Union([
	t.Object({ decision: t.Literal("approve"), reason: t.Optional(t.String({ maxLength: 2_000 })) }),
	t.Object({ decision: t.Literal("reject"), reason: t.String({ minLength: 1, maxLength: 2_000 }) }),
]);

export const KillZoneThemeRevisionBody = t.Object(
	{ reason: t.String({ minLength: 1, maxLength: 2_000 }) },
	{ additionalProperties: false },
);

export const ZoneThemeReviewQueueQuery = t.Object(
	{
		cursor: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 25 })),
	},
	{ additionalProperties: false },
);

export const ScheduleZoneThemeRevalidationBody = t.Object(
	{
		sourceContractVersion: t.String({ minLength: 1, maxLength: 32 }),
		cursor: t.Optional(Uuid),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 1_000, default: 250 })),
	},
	{ additionalProperties: false },
);

export const ZoneThemeResponse = t.Object({
	id: Uuid,
	language: t.String(),
	title: t.String(),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const ZoneThemeRevisionResponse = t.Object({
	id: Uuid,
	themeUnitId: Uuid,
	contractVersion: t.String(),
	sha256: t.String({ pattern: "^[0-9a-f]{64}$" }),
	state: t.UnionEnum(ZoneThemeRevisionStateValues),
	automatedReview: AutomatedStaticReview,
	renderReview: t.Nullable(CompleteZoneThemeAutomatedReviewBody.properties.renderReview),
	aiReview: t.Nullable(CompleteZoneThemeAutomatedReviewBody.properties.aiReview),
	decisionReason: t.Nullable(t.String()),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const ZoneThemeRevisionListResponse = t.Object({
	items: t.Array(ZoneThemeRevisionResponse),
	nextCursor: t.Nullable(Uuid),
});

export const ZoneThemeReviewQueueResponse = t.Object({
	items: t.Array(
		t.Intersect([
			ZoneThemeRevisionResponse,
			t.Object({
				sourceCss: t.String({ maxLength: 65_536 }),
				transformedCss: t.String({ maxLength: 65_536 }),
				assetIds: t.Array(Uuid, { maxItems: MaximumZoneThemeAssets, uniqueItems: true }),
			}),
		]),
	),
	nextCursor: t.Nullable(Uuid),
});
export const ScheduleZoneThemeRevalidationResponse = t.Object({
	updated: t.Integer({ minimum: 0 }),
	rejected: t.Integer({ minimum: 0 }),
	contractVersion: t.String(),
	nextCursor: t.Nullable(Uuid),
});
