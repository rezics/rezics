import { t } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";

import {
	StudioPermissionValues,
	StudioSectionValues,
	StudioSortValues,
	StudioViewValues,
	StudioWorkStateValues,
	type StudioContentListQuery,
	type StudioPermission,
	type StudioSection,
	type StudioSort,
	type StudioView,
	type StudioWorkState,
} from "../api/users/schema";
import {
	ContentLanguageValues,
	ResourceVisibilityValues,
	UnitStatusValues,
} from "../database/schema/contract-values";
import { InvalidPaginationCursor } from "../pagination/errors";
import { parseJsonCursor } from "../pagination";

type UnitStatus = NonNullable<StudioContentListQuery["status"]>;
type ResourceVisibility = NonNullable<StudioContentListQuery["visibility"]>;

const StudioCursor = t.Object(
	{
		v: t.Literal(1),
		section: t.UnionEnum(StudioSectionValues, { default: undefined }),
		view: t.UnionEnum(StudioViewValues, { default: undefined }),
		permission: t.Nullable(t.UnionEnum(StudioPermissionValues, { default: undefined })),
		workState: t.Nullable(t.UnionEnum(StudioWorkStateValues, { default: undefined })),
		status: t.Nullable(t.UnionEnum(UnitStatusValues, { default: undefined })),
		visibility: t.Nullable(t.UnionEnum(ResourceVisibilityValues, { default: undefined })),
		sort: t.UnionEnum(StudioSortValues, { default: undefined }),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues, { default: undefined }), {
			uniqueItems: true,
		}),
		bucket: t.Boolean(),
		sortAt: t.String({ format: "date-time" }),
		unitId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export type StudioCursorScope = {
	readonly section: StudioSection;
	readonly view: StudioView;
	readonly permission?: StudioPermission;
	readonly workState?: StudioWorkState;
	readonly status?: UnitStatus;
	readonly visibility?: ResourceVisibility;
	readonly sort: StudioSort;
	readonly localizationLanguages: readonly ContentLanguage[];
};

export type StudioCursorBoundary = {
	readonly bucket: boolean;
	readonly sortAt: Date;
	readonly unitId: string;
};

function cursorScope(query: StudioContentListQuery): StudioCursorScope {
	return {
		section: query.section,
		view: query.view ?? "all",
		permission: query.permission,
		workState: query.workState,
		status: query.status,
		visibility: query.visibility,
		sort: query.sort ?? "recent",
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
			v: 1,
			...cursorScope(query),
			permission: query.permission ?? null,
			workState: query.workState ?? null,
			status: query.status ?? null,
			visibility: query.visibility ?? null,
			bucket: boundary.bucket,
			sortAt: boundary.sortAt.toISOString(),
			unitId: boundary.unitId,
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
			cursor.view !== scope.view ||
			cursor.permission !== (scope.permission ?? null) ||
			cursor.workState !== (scope.workState ?? null) ||
			cursor.status !== (scope.status ?? null) ||
			cursor.visibility !== (scope.visibility ?? null) ||
			cursor.sort !== scope.sort ||
			!sameArray(cursor.localizationLanguages, scope.localizationLanguages)
		)
			throw new InvalidPaginationCursor();
		const sortAt = new Date(cursor.sortAt);
		if (Number.isNaN(sortAt.getTime())) throw new InvalidPaginationCursor();
		return { bucket: cursor.bucket, sortAt, unitId: cursor.unitId };
	} catch {
		throw new InvalidPaginationCursor();
	}
}
