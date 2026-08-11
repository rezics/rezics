import { t } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";

import {
	StudioWorkspaceSourceValues,
	type StudioContentListQuery,
	type StudioWorkspaceSource,
} from "../api/users/schema";
import {
	ContentLanguageValues,
	ResourceVisibilityValues,
	UnitStatusValues,
} from "../database/schema/contract-values";
import { parseJsonCursor } from "../pagination";
import { InvalidPaginationCursor } from "../pagination/errors";
import { ResourceSectionValues, type ResourceSection } from "../units/resource-section";

type UnitStatus = NonNullable<StudioContentListQuery["status"]>;
type ResourceVisibility = NonNullable<StudioContentListQuery["visibility"]>;

const StudioCursor = t.Object(
	{
		v: t.Literal(2),
		section: t.UnionEnum(ResourceSectionValues, { default: undefined }),
		source: t.UnionEnum(StudioWorkspaceSourceValues, { default: undefined }),
		status: t.Nullable(t.UnionEnum(UnitStatusValues, { default: undefined })),
		visibility: t.Nullable(t.UnionEnum(ResourceVisibilityValues, { default: undefined })),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues, { default: undefined }), {
			uniqueItems: true,
		}),
		relevantAt: t.String({ format: "date-time" }),
		unitId: t.String({ format: "uuid" }),
		sourceKey: t.String({ minLength: 1, maxLength: 128 }),
	},
	{ additionalProperties: false },
);

export type StudioCursorScope = {
	readonly section: ResourceSection;
	readonly source: StudioWorkspaceSource;
	readonly status?: UnitStatus;
	readonly visibility?: ResourceVisibility;
	readonly localizationLanguages: readonly ContentLanguage[];
};

export type StudioCursorBoundary = {
	readonly relevantAt: Date;
	readonly unitId: string;
	readonly sourceKey: string;
};

function cursorScope(query: StudioContentListQuery): StudioCursorScope {
	return {
		section: query.section,
		source: query.source ?? "all",
		status: query.status,
		visibility: query.visibility,
		localizationLanguages: query.localizationLanguages ?? [],
	};
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function encodeStudioCursor(
	query: StudioContentListQuery,
	boundary: StudioCursorBoundary,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 2,
			...cursorScope(query),
			status: query.status ?? null,
			visibility: query.visibility ?? null,
			relevantAt: boundary.relevantAt.toISOString(),
			unitId: boundary.unitId,
			sourceKey: boundary.sourceKey,
		}),
	).toString("base64url");
}

export function decodeStudioCursor(
	value: string | undefined,
	query: StudioContentListQuery,
): StudioCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, StudioCursor);
		const scope = cursorScope(query);
		if (
			cursor.section !== scope.section ||
			cursor.source !== scope.source ||
			cursor.status !== (scope.status ?? null) ||
			cursor.visibility !== (scope.visibility ?? null) ||
			!sameArray(cursor.localizationLanguages, scope.localizationLanguages)
		)
			throw new InvalidPaginationCursor();
		const relevantAt = new Date(cursor.relevantAt);
		if (Number.isNaN(relevantAt.getTime())) throw new InvalidPaginationCursor();
		return {
			relevantAt,
			unitId: cursor.unitId,
			sourceKey: cursor.sourceKey,
		};
	} catch {
		throw new InvalidPaginationCursor();
	}
}
