import type { StaticDecode } from "typebox";
import { t } from "elysia";

import {
	GovernanceMaxRuleReferences,
	ContentReviewCaseStateValues,
} from "../../database/schema/contract-values";
import { ContentLanguage, DateTime, LocalizationLanguageQuery, UnitKind, Uuid } from "../schema";
import { GovernanceRuleReference } from "../governance/schema";
import { NullablePublicSlugAddressResponse } from "../slug-addresses/schema";

export const ReportRuleReferenceInput = GovernanceRuleReference;
export type ReportRuleReferenceInput = StaticDecode<typeof ReportRuleReferenceInput>;

export const CreateReportBody = t.Object(
	{
		contextRealmId: t.Optional(Uuid),
		rules: t.Array(ReportRuleReferenceInput, {
			minItems: 1,
			maxItems: GovernanceMaxRuleReferences,
			uniqueItems: true,
		}),
		details: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
	},
	{ additionalProperties: false },
);
export type CreateReportBody = StaticDecode<typeof CreateReportBody>;

export const ReportUnitParams = t.Object({ unitId: Uuid });
export type ReportUnitParams = StaticDecode<typeof ReportUnitParams>;

export const ReportRealmParams = t.Object({ realmId: Uuid });
export type ReportRealmParams = StaticDecode<typeof ReportRealmParams>;

export const ReviewCaseParams = t.Object({ caseId: Uuid });
export type ReviewCaseParams = StaticDecode<typeof ReviewCaseParams>;

const CursorLimitQuery = {
	cursor: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
};

export const CreateReportQuery = t.Object(LocalizationLanguageQuery, {
	additionalProperties: false,
});
export type CreateReportQuery = StaticDecode<typeof CreateReportQuery>;

export const ListMyReportsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		...CursorLimitQuery,
		reportId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export type ListMyReportsQuery = StaticDecode<typeof ListMyReportsQuery>;

export const ListRealmReportsQuery = t.Object(
	{
		unitId: t.Optional(Uuid),
		state: t.Optional(t.UnionEnum(ContentReviewCaseStateValues, { default: undefined })),
		...LocalizationLanguageQuery,
		...CursorLimitQuery,
	},
	{ additionalProperties: false },
);
export type ListRealmReportsQuery = StaticDecode<typeof ListRealmReportsQuery>;

export const ListPlatformReportCasesQuery = t.Object(
	{
		state: t.Optional(t.UnionEnum(ContentReviewCaseStateValues, { default: undefined })),
		...LocalizationLanguageQuery,
		...CursorLimitQuery,
	},
	{ additionalProperties: false },
);
export type ListPlatformReportCasesQuery = StaticDecode<typeof ListPlatformReportCasesQuery>;

export const ListReviewCaseReportsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		...CursorLimitQuery,
	},
	{ additionalProperties: false },
);
export type ListReviewCaseReportsQuery = StaticDecode<typeof ListReviewCaseReportsQuery>;

export const ReportDestinationsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		contextRealmId: t.Optional(Uuid),
	},
	{ additionalProperties: false },
);
export type ReportDestinationsQuery = StaticDecode<typeof ReportDestinationsQuery>;

export const ReportRuleResponse = t.Object(
	{
		id: Uuid,
		sourceRealmId: Uuid,
		revisionId: Uuid,
		language: ContentLanguage,
		title: t.String(),
	},
	{ additionalProperties: false },
);
export type ReportRuleResponse = StaticDecode<typeof ReportRuleResponse>;

export const ReportReferralResponse = t.Object(
	{
		id: Uuid,
		caseId: Uuid,
		scope: t.Union([t.Literal("realm"), t.Literal("platform")]),
		realmId: t.Nullable(Uuid),
		caseState: t.UnionEnum(ContentReviewCaseStateValues, { default: undefined }),
	},
	{ additionalProperties: false },
);
export type ReportReferralResponse = StaticDecode<typeof ReportReferralResponse>;

export const ReportResponse = t.Object(
	{
		id: Uuid,
		unitId: Uuid,
		contextRealmId: t.Nullable(Uuid),
		rules: t.Array(ReportRuleResponse, {
			minItems: 1,
			maxItems: GovernanceMaxRuleReferences,
		}),
		referrals: t.Array(ReportReferralResponse, { minItems: 1, maxItems: 2 }),
		details: t.Nullable(t.String()),
		reportedRevisionId: Uuid,
		createdAt: DateTime,
	},
	{ additionalProperties: false },
);
export type ReportResponse = StaticDecode<typeof ReportResponse>;

export const ReportListResponse = t.Object(
	{
		items: t.Array(ReportResponse),
		nextCursor: t.Nullable(t.String()),
	},
	{ additionalProperties: false },
);

export const MyReportStatusValues = [
	"submitted",
	"reviewing",
	"completed",
	"merged",
	"not_actioned",
] as const;
export const MyReportStatus = t.UnionEnum(MyReportStatusValues, { default: undefined });
export type MyReportStatus = StaticDecode<typeof MyReportStatus>;

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

const MyReportReferralResponse = t.Interface(
	[ReportReferralResponse],
	{
		destinationTitle: t.Nullable(t.String()),
		status: MyReportStatus,
	},
	{ additionalProperties: false },
);

export const MyReportResponse = t.Object(
	{
		id: Uuid,
		status: MyReportStatus,
		target: MyReportTargetResponse,
		rules: t.Array(ReportRuleResponse, {
			minItems: 1,
			maxItems: GovernanceMaxRuleReferences,
		}),
		referrals: t.Array(MyReportReferralResponse, { minItems: 1, maxItems: 2 }),
		details: t.Nullable(t.String()),
		createdAt: DateTime,
	},
	{ additionalProperties: false },
);
export type MyReportResponse = StaticDecode<typeof MyReportResponse>;

export const MyReportListResponse = t.Object(
	{
		items: t.Array(MyReportResponse),
		nextCursor: t.Nullable(t.String()),
	},
	{ additionalProperties: false },
);

const ReportDestinationRule = t.Object(
	{
		id: Uuid,
		language: ContentLanguage,
		title: t.String(),
	},
	{ additionalProperties: false },
);

export const ReportDestinationsResponse = t.Object(
	{
		items: t.Array(
			t.Object(
				{
					id: Uuid,
					scope: t.Union([t.Literal("platform"), t.Literal("realm")]),
					language: ContentLanguage,
					title: t.Nullable(t.String()),
					revisionId: Uuid,
					rules: t.Array(ReportDestinationRule, { minItems: 1, maxItems: 100 }),
				},
				{ additionalProperties: false },
			),
			{ minItems: 1, maxItems: 2 },
		),
	},
	{ additionalProperties: false },
);

const PlatformModerationStatus = t.Union([
	t.Literal("approved"),
	t.Literal("pending"),
	t.Literal("removed"),
]);

const PlatformModerationCommand = t.Union([
	t.Literal("approve"),
	t.Literal("remove"),
	t.Literal("restore"),
	t.Literal("lock_post_targeting"),
	t.Literal("unlock_post_targeting"),
	t.Literal("invalidate_license"),
	t.Literal("restore_license"),
	t.Literal("dismiss"),
	t.Literal("note"),
]);

const PlatformReportCaseLicenseGrant = t.Union([
	t.Object(
		{
			id: Uuid,
			licenseId: t.String({ minLength: 1 }),
			recognitionStatus: t.Literal("recognized"),
			offeringEnded: t.Literal(false),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			id: Uuid,
			licenseId: t.String({ minLength: 1 }),
			recognitionStatus: t.Literal("invalidated"),
			offeringEnded: t.Literal(false),
			invalidationActionId: Uuid,
		},
		{ additionalProperties: false },
	),
]);

export const PlatformReportCaseResponse = t.Object(
	{
		caseId: Uuid,
		caseState: t.UnionEnum(ContentReviewCaseStateValues, { default: undefined }),
		unitId: Uuid,
		unitKind: t.String(),
		language: ContentLanguage,
		title: t.Nullable(t.String()),
		moderationStatus: PlatformModerationStatus,
		postTargetingLocked: t.Boolean(),
		licenseGrants: t.Array(PlatformReportCaseLicenseGrant),
		reportCount: t.Integer({ minimum: 1 }),
		allowedCommands: t.Array(PlatformModerationCommand, { minItems: 1 }),
		createdAt: DateTime,
		updatedAt: DateTime,
	},
	{ additionalProperties: false },
);

export const PlatformReportCaseListResponse = t.Object(
	{
		items: t.Array(PlatformReportCaseResponse),
		nextCursor: t.Nullable(t.String()),
	},
	{ additionalProperties: false },
);
