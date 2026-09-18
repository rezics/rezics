import { t } from "elysia";

import {
	ContentRatingValues,
	ContentLanguageValues,
	type FollowableUnitOwner,
	FollowableUnitOwnerValues,
} from "@rezics/schema/postgres/shared/contract-values";
import type { ContentLanguage } from "@rezics/i18n";
import { InvalidPaginationCursor } from "../pagination/errors";
import { parseJsonCursor } from "../pagination";
import { isStorageSafeFractionalPosition } from "@rezics/schema/contracts/native/positions";

const FollowingCursor = t.Object(
	{
		v: t.Literal(4),
		owner: t.Nullable(t.UnionEnum(FollowableUnitOwnerValues)),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues), {
			uniqueItems: true,
		}),
		contentRatings: t.Array(t.UnionEnum(ContentRatingValues), { uniqueItems: true }),
		favorite: t.Boolean(),
		position: t.String({ minLength: 2, maxLength: 512 }),
		targetReferenceId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

export type FollowingCursorBoundary = {
	readonly favorite: boolean;
	readonly position: string;
	readonly targetReferenceId: string;
};

export function encodeFollowingCursor(
	owner: FollowableUnitOwner | undefined,
	localizationLanguages: readonly ContentLanguage[],
	contentRatings: readonly (typeof ContentRatingValues)[number][],
	boundary: FollowingCursorBoundary,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 4,
			owner: owner ?? null,
			localizationLanguages,
			contentRatings,
			favorite: boundary.favorite,
			position: boundary.position,
			targetReferenceId: boundary.targetReferenceId,
		}),
	).toString("base64url");
}

export function decodeFollowingCursor(
	value: string | undefined,
	owner: FollowableUnitOwner | undefined,
	localizationLanguages: readonly ContentLanguage[],
	contentRatings: readonly (typeof ContentRatingValues)[number][],
): FollowingCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, FollowingCursor);
		if (
			cursor.owner !== (owner ?? null) ||
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
			targetReferenceId: cursor.targetReferenceId,
		};
	} catch {
		throw new InvalidPaginationCursor();
	}
}
