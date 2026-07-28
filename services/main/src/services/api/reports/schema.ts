import { type Static, t } from "elysia";

import {
	ModerationCaseStateValues,
	ReportReasonValues,
} from "../../database/schema/contract-values";
import { ContentLanguage, DateTime, LocalizationLanguageQuery, Uuid } from "../schema";

export const ReportReason = t.UnionEnum(ReportReasonValues, { default: undefined });
export type ReportReason = Static<typeof ReportReason>;

export const CreateReportBody = t.Object(
	{
		reason: ReportReason,
		details: t.Optional(t.String({ minLength: 1, maxLength: 2_000 })),
	},
	{ additionalProperties: false },
);
export type CreateReportBody = Static<typeof CreateReportBody>;

export const ReportTargetParams = t.Object({ realmId: Uuid, unitId: Uuid });
export type ReportTargetParams = Static<typeof ReportTargetParams>;

export const ReportRealmParams = t.Object({ realmId: Uuid });
export type ReportRealmParams = Static<typeof ReportRealmParams>;

export const ReportUnitParams = t.Object({ unitId: Uuid });
export type ReportUnitParams = Static<typeof ReportUnitParams>;

export const ListMyReportsQuery = t.Object(
	{ limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })) },
	{ additionalProperties: false },
);
export type ListMyReportsQuery = Static<typeof ListMyReportsQuery>;

export const ListRealmReportsQuery = t.Object(
	{
		unitId: t.Optional(Uuid),
		state: t.Optional(t.UnionEnum(ModerationCaseStateValues, { default: undefined })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListRealmReportsQuery = Static<typeof ListRealmReportsQuery>;

export const ReportRealmOptionsQuery = t.Object(
	{
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 100 })),
	},
	{ additionalProperties: false },
);
export type ReportRealmOptionsQuery = Static<typeof ReportRealmOptionsQuery>;

export const ReportResponse = t.Object({
	id: Uuid,
	caseId: Uuid,
	realmId: Uuid,
	unitId: Uuid,
	reason: ReportReason,
	details: t.Nullable(t.String()),
	reportedRevisionId: Uuid,
	caseState: t.UnionEnum(ModerationCaseStateValues, { default: undefined }),
	createdAt: DateTime,
});

export const ReportListResponse = t.Object({ items: t.Array(ReportResponse) });

export const ReportRealmOptionsResponse = t.Object({
	items: t.Array(
		t.Object({
			id: Uuid,
			language: ContentLanguage,
			title: t.Nullable(t.String()),
		}),
	),
});
