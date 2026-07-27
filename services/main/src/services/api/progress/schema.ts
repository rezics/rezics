import { type Static, t } from "elysia";

import { ProgressStatusValues } from "../../database/schema/contract-values";
import { LocalizationLanguageQuery, Uuid } from "../schema";
import { ProgressResponse } from "../schema/response";

const ProgressStatus = t.Union(ProgressStatusValues.map((value) => t.Literal(value)));

export const ListProgressQuery = t.Object(
	{
		status: t.Optional(ProgressStatus),
		...LocalizationLanguageQuery,
		limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	},
	{ additionalProperties: false },
);
export type ListProgressQuery = Static<typeof ListProgressQuery>;

export const ProgressUnitParams = t.Object({ unitId: Uuid });
export type ProgressUnitParams = Static<typeof ProgressUnitParams>;

export const ProgressLookupResponse = t.Union([
	t.Object({ state: t.Literal("untracked") }, { additionalProperties: false }),
	t.Object(
		{
			state: t.Literal("tracked"),
			record: ProgressResponse,
		},
		{ additionalProperties: false },
	),
]);
export type ProgressLookupResponse = Static<typeof ProgressLookupResponse>;

export const UpsertProgressBody = t.Object(
	{
		status: ProgressStatus,
		progress: t.Optional(t.Number({ minimum: 0, maximum: 1 })),
		totalTimeMs: t.Optional(t.Integer({ minimum: 0 })),
		lastContentStructureNodeId: t.Optional(t.Nullable(Uuid)),
	},
	{ additionalProperties: false },
);
export type UpsertProgressBody = Static<typeof UpsertProgressBody>;

export const CompleteProgressBody = t.Object(
	{
		totalTimeMs: t.Optional(t.Integer({ minimum: 0 })),
	},
	{ additionalProperties: false },
);
export type CompleteProgressBody = Static<typeof CompleteProgressBody>;

export const ProgressNodeParams = t.Object({ unitId: Uuid, nodeId: Uuid });
export type ProgressNodeParams = Static<typeof ProgressNodeParams>;
