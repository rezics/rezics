import type { StaticDecode } from "typebox";
import { t } from "elysia";
import { SearchFeatureInput } from "@rezics/filter";

import {
	ProgressDatePrecisionValues,
	ProgressEntryKindValues,
	ProgressStatusValues,
} from "../../database/schema/contract-values";
import { DateTime, LocalizationLanguageQuery, ResourceVisibility, Uuid } from "../schema";
import { ProgressResponse } from "../schema/response";

const ProgressStatus = t.Union(ProgressStatusValues.map((value) => t.Literal(value)));
const ProgressEntryKind = t.UnionEnum(ProgressEntryKindValues);
const ProgressDatePrecision = t.UnionEnum(ProgressDatePrecisionValues);
const SafeDurationMs = t.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });

export const ListProgressQuery = t.Object(
	{
		status: t.Optional(ProgressStatus),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListProgressQuery = StaticDecode<typeof ListProgressQuery>;

const ProgressSearchFeatureExecution = t.Omit(SearchFeatureInput, ["filterDocument", "contexts"]);
export const ProgressSearchBody = t.Object(
	{
		...ProgressSearchFeatureExecution.properties,
		...LocalizationLanguageQuery,
	},
	{ additionalProperties: false },
);
export type ProgressSearchBody = StaticDecode<typeof ProgressSearchBody>;

export const ProgressUnitParams = t.Object({ unitId: Uuid });
export type ProgressUnitParams = StaticDecode<typeof ProgressUnitParams>;

export const ProgressContinuationResponse = t.Union([
	t.Object(
		{ kind: t.Literal("book-node"), bookId: Uuid, nodeId: Uuid },
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: t.Literal("unit"),
			contentUnit: t.Object(
				{ id: Uuid, type: t.UnionEnum(["video", "audio"]) },
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			kind: t.Literal("contents"),
			ownerUnit: t.Object(
				{ id: Uuid, type: t.UnionEnum(["book", "media"]) },
				{ additionalProperties: false },
			),
		},
		{ additionalProperties: false },
	),
	t.Object({ kind: t.Literal("none") }, { additionalProperties: false }),
]);
export type ProgressContinuationResponse = StaticDecode<typeof ProgressContinuationResponse>;

export const ProgressLookupResponse = t.Union([
	t.Object({ state: t.Literal("untracked") }, { additionalProperties: false }),
	t.Object(
		{
			state: t.Literal("tracked"),
			record: ProgressResponse,
			continuation: ProgressContinuationResponse,
		},
		{ additionalProperties: false },
	),
]);
export type ProgressLookupResponse = StaticDecode<typeof ProgressLookupResponse>;

export const UpsertProgressBody = t.Object(
	{
		status: ProgressStatus,
		progress: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
		totalTimeMs: t.Optional(SafeDurationMs),
		lastContentStructureNodeId: t.Optional(t.Nullable(Uuid)),
		visibility: t.Optional(ResourceVisibility),
	},
	{ additionalProperties: false },
);
export type UpsertProgressBody = StaticDecode<typeof UpsertProgressBody>;

export const CompleteProgressBody = t.Object(
	{
		totalTimeMs: t.Optional(SafeDurationMs),
		visibility: t.Optional(ResourceVisibility),
	},
	{ additionalProperties: false },
);
export type CompleteProgressBody = StaticDecode<typeof CompleteProgressBody>;

export const ProgressNodeParams = t.Object({ unitId: Uuid, nodeId: Uuid });
export type ProgressNodeParams = StaticDecode<typeof ProgressNodeParams>;

export const ListProgressEntriesQuery = t.Object(
	{
		cursor: t.Optional(t.String({ maxLength: 1024 })),
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 30 })),
		status: t.Optional(ProgressStatus),
	},
	{ additionalProperties: false },
);
export type ListProgressEntriesQuery = StaticDecode<typeof ListProgressEntriesQuery>;

export const ProgressEntryParams = t.Object({ unitId: Uuid, entryId: Uuid });
export type ProgressEntryParams = StaticDecode<typeof ProgressEntryParams>;

const ProgressEntryWriteFields = {
	entryKind: ProgressEntryKind,
	status: ProgressStatus,
	progress: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
	totalTimeMs: t.Optional(SafeDurationMs),
	lastContentStructureNodeId: t.Optional(t.Nullable(Uuid)),
	occurredAt: t.Nullable(DateTime),
	datePrecision: ProgressDatePrecision,
} as const;

export const CreateProgressEntryBody = t.Object(ProgressEntryWriteFields, {
	additionalProperties: false,
});
export type CreateProgressEntryBody = StaticDecode<typeof CreateProgressEntryBody>;

export const ReplaceProgressEntryBody = t.Object(ProgressEntryWriteFields, {
	additionalProperties: false,
});
export type ReplaceProgressEntryBody = StaticDecode<typeof ReplaceProgressEntryBody>;
