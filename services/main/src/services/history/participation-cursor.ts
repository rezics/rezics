import { t } from "elysia";

import {
	ContributionResourceKindValues,
	type ContributionResourceListQuery,
} from "../api/history/schema";
import { ContentLanguageValues } from "../database/schema/contract-values";
import { parseJsonCursor } from "../pagination";
import { InvalidPaginationCursor } from "../pagination/errors";
import { ResourceSectionValues } from "../units/resource-section";

const ParticipationCursor = t.Object(
	{
		v: t.Literal(2),
		section: t.Nullable(t.UnionEnum(ResourceSectionValues, { default: undefined })),
		kind: t.UnionEnum(ContributionResourceKindValues, { default: undefined }),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues, { default: undefined }), {
			uniqueItems: true,
		}),
		sortAt: t.String({ format: "date-time" }),
		resourceUnitId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export type ParticipationCursorBoundary = {
	readonly sortAt: Date;
	readonly resourceUnitId: string;
};

function scope(query: ContributionResourceListQuery) {
	return {
		section: query.section,
		kind: query.kind ?? "all",
		localizationLanguages: query.localizationLanguages ?? [],
	};
}

function sameArray(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function encodeParticipationCursor(
	query: ContributionResourceListQuery,
	boundary: ParticipationCursorBoundary,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 2,
			...scope(query),
			section: query.section ?? null,
			sortAt: boundary.sortAt.toISOString(),
			resourceUnitId: boundary.resourceUnitId,
		}),
	).toString("base64url");
}

export function decodeParticipationCursor(
	value: string | undefined,
	query: ContributionResourceListQuery,
): ParticipationCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, ParticipationCursor);
		const expected = scope(query);
		if (
			cursor.section !== (expected.section ?? null) ||
			cursor.kind !== expected.kind ||
			!sameArray(cursor.localizationLanguages, expected.localizationLanguages)
		)
			throw new InvalidPaginationCursor();
		const sortAt = new Date(cursor.sortAt);
		if (Number.isNaN(sortAt.getTime())) throw new InvalidPaginationCursor();
		return { sortAt, resourceUnitId: cursor.resourceUnitId };
	} catch {
		throw new InvalidPaginationCursor();
	}
}
