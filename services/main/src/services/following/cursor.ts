import { t } from "elysia";

import {
	ContentRatingValues,
	ContentLanguageValues,
	type FollowableUnitKind,
	FollowableUnitKindValues,
} from "../database/schema/contract-values";
import type { ContentLanguage } from "@rezics/i18n";
import { InvalidPaginationCursor } from "../pagination/errors";
import { parseJsonCursor } from "../pagination";
import { isStorageSafeFractionalPosition } from "../ordering/position";

const FollowingCursor = t.Object(
	{
		v: t.Literal(3),
		kind: t.Nullable(t.UnionEnum(FollowableUnitKindValues)),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues), {
			uniqueItems: true,
		}),
		contentRatings: t.Array(t.UnionEnum(ContentRatingValues), { uniqueItems: true }),
		favorite: t.Boolean(),
		position: t.String({ minLength: 2, maxLength: 512 }),
		unitId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export type FollowingCursorBoundary = {
	readonly favorite: boolean;
	readonly position: string;
	readonly unitId: string;
};

export function encodeFollowingCursor(
	kind: FollowableUnitKind | undefined,
	localizationLanguages: readonly ContentLanguage[],
	contentRatings: readonly (typeof ContentRatingValues)[number][],
	boundary: FollowingCursorBoundary,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 3,
			kind: kind ?? null,
			localizationLanguages,
			contentRatings,
			...boundary,
		}),
	).toString("base64url");
}

export function decodeFollowingCursor(
	value: string | undefined,
	kind: FollowableUnitKind | undefined,
	localizationLanguages: readonly ContentLanguage[],
	contentRatings: readonly (typeof ContentRatingValues)[number][],
): FollowingCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, FollowingCursor);
		if (
			cursor.kind !== (kind ?? null) ||
			cursor.localizationLanguages.length !== localizationLanguages.length ||
			cursor.localizationLanguages.some(
				(language, index) => language !== localizationLanguages[index],
			) ||
			cursor.contentRatings.length !== contentRatings.length ||
			cursor.contentRatings.some((rating, index) => rating !== contentRatings[index])
		)
			throw new InvalidPaginationCursor();
		if (!isStorageSafeFractionalPosition(cursor.position)) throw new InvalidPaginationCursor();
		return {
			favorite: cursor.favorite,
			position: cursor.position,
			unitId: cursor.unitId,
		};
	} catch {
		throw new InvalidPaginationCursor();
	}
}
