import { type Static, t } from "elysia";

import {
	ModerationCaseStateValues,
	PlatformUnitModerationCommandValues,
} from "../../database/schema/contract-values";
import { ContentLanguage, DateTime, LocalizationLanguageQuery, UnitKind, Uuid } from "../schema";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";

export const CreateReportBody = t.Object(
	{
		ruleRealmId: Uuid,
		ruleId: Uuid,
		details: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
	},
	{ additionalProperties: false },
);
export type CreateReportBody = Static<typeof CreateReportBody>;

export const ReportUnitParams = t.Object({ unitId: Uuid });
export type ReportUnitParams = Static<typeof ReportUnitParams>;

export const ReportRealmParams = t.Object({ realmId: Uuid });
export type ReportRealmParams = Static<typeof ReportRealmParams>;

const LimitQuery = {
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
};

export const CreateReportQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type CreateReportQuery = Static<typeof CreateReportQuery>;

export const ListMyReportsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		cursor: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
		reportId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export type ListMyReportsQuery = Static<typeof ListMyReportsQuery>;

export const ListRealmReportsQuery = t.Object(
	{
		unitId: t.Optional(Uuid),
		state: t.Optional(t.UnionEnum(ModerationCaseStateValues, { default: undefined })),
		...LocalizationLanguageQuery,
		...LimitQuery,
	},
	{ additionalProperties: false },
);
export type ListRealmReportsQuery = Static<typeof ListRealmReportsQuery>;

export const ListPlatformReportCasesQuery = t.Object(
	{
		state: t.Optional(t.UnionEnum(ModerationCaseStateValues, { default: undefined })),
		...LocalizationLanguageQuery,
		...LimitQuery,
	},
	{ additionalProperties: false },
);
export type ListPlatformReportCasesQuery = Static<typeof ListPlatformReportCasesQuery>;

export const ReportDestinationsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 100 })),
	},
	{ additionalProperties: false },
);
export type ReportDestinationsQuery = Static<typeof ReportDestinationsQuery>;

const ReportRuleResponse = t.Object({
	id: Uuid,
	revisionId: Uuid,
	language: ContentLanguage,
	title: t.String(),
});

const ReportCommonResponse = {
	id: Uuid,
	caseId: Uuid,
	unitId: Uuid,
	rule: ReportRuleResponse,
	details: t.Nullable(t.String()),
	reportedRevisionId: Uuid,
	caseState: t.UnionEnum(ModerationCaseStateValues, { default: undefined }),
	createdAt: DateTime,
};

export const RealmUnitReportResponse = t.Object({
	...ReportCommonResponse,
	scope: t.Literal("realm"),
	realmId: Uuid,
});

export const PlatformUnitReportResponse = t.Object({
	...ReportCommonResponse,
	scope: t.Literal("platform"),
	ruleSourceRealmId: Uuid,
});

export const ReportResponse = t.Union([RealmUnitReportResponse, PlatformUnitReportResponse]);
export type ReportResponse = Static<typeof ReportResponse>;

export const ReportListResponse = t.Object({ items: t.Array(ReportResponse) });

export const MyReportStatusValues = [
	"submitted",
	"reviewing",
	"completed",
	"merged",
	"not_actioned",
] as const;
export const MyReportStatus = t.UnionEnum(MyReportStatusValues, { default: undefined });
export type MyReportStatus = Static<typeof MyReportStatus>;

const MyReportTargetResponse = t.Union([
	t.Object(
		{
			state: t.Literal("available"),
			unit: t.Object(
				{
					id: Uuid,
					kind: UnitKind,
					language: t.Nullable(ContentLanguage),
					title: t.Nullable(t.String()),
					slugAddress: NullablePublicSlugAddressResponse,
				},
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
	t.Object({ state: t.Literal("unavailable") }, { additionalProperties: false }),
]);

export const MyReportResponse = t.Object(
	{
		id: Uuid,
		scope: t.Union([t.Literal("realm"), t.Literal("platform")]),
		status: MyReportStatus,
		target: MyReportTargetResponse,
		rule: t.Object(
			{
				language: ContentLanguage,
				title: t.String(),
			},
			{ additionalProperties: false },
		),
		details: t.Nullable(t.String()),
		createdAt: DateTime,
	},
	{ additionalProperties: false },
);
export type MyReportResponse = Static<typeof MyReportResponse>;

export const MyReportListResponse = t.Object(
	{
		items: t.Array(MyReportResponse),
		nextCursor: t.Nullable(t.String()),
	},
	{ additionalProperties: false },
);

export const ReportDestinationsResponse = t.Object({
	items: t.Array(
		t.Union([
			t.Object({
				id: Uuid,
				scope: t.Literal("platform"),
				language: ContentLanguage,
				title: t.Nullable(t.String()),
			}),
			t.Object({
				id: Uuid,
				scope: t.Literal("realm"),
				language: ContentLanguage,
				title: t.Nullable(t.String()),
			}),
		]),
	),
});

const PlatformModerationStatus = t.Union([
	t.Literal("approved"),
	t.Literal("pending"),
	t.Literal("removed"),
]);

export const PlatformReportCaseResponse = t.Object({
	caseId: Uuid,
	caseState: t.UnionEnum(ModerationCaseStateValues, { default: undefined }),
	unitId: Uuid,
	unitKind: t.String(),
	language: ContentLanguage,
	title: t.Nullable(t.String()),
	moderationStatus: PlatformModerationStatus,
	postTargetingLocked: t.Boolean(),
	openReportCount: t.Integer({ minimum: 0 }),
	allowedCommands: t.Array(t.UnionEnum(PlatformUnitModerationCommandValues), {
		minItems: 1,
	}),
	reports: t.Array(PlatformUnitReportResponse, { minItems: 1 }),
	createdAt: DateTime,
	updatedAt: DateTime,
});

export const PlatformReportCaseListResponse = t.Object({
	items: t.Array(PlatformReportCaseResponse),
});
