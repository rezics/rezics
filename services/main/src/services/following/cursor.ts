import { t } from "elysia";

import {
	ContentLanguageValues,
	type UnitKind,
	UnitKindValues,
} from "../database/schema/contract-values";
import type { ContentLanguage } from "@rezics/i18n";
import { InvalidPaginationCursor } from "../pagination/errors";
import { parseJsonCursor } from "../pagination";
import { isFractionalPosition } from "../ordering/position";

const FollowingCursor = t.Object(
	{
		v: t.Literal(2),
		kind: t.Nullable(t.UnionEnum(UnitKindValues)),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues), {
			uniqueItems: true,
		}),
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
	kind: UnitKind | undefined,
	localizationLanguages: readonly ContentLanguage[],
	boundary: FollowingCursorBoundary,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 2,
			kind: kind ?? null,
			localizationLanguages,
			...boundary,
		}),
	).toString("base64url");
}

export function decodeFollowingCursor(
	value: string | undefined,
	kind: UnitKind | undefined,
	localizationLanguages: readonly ContentLanguage[],
): FollowingCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, FollowingCursor);
		if (
			cursor.kind !== (kind ?? null) ||
			cursor.localizationLanguages.length !== localizationLanguages.length ||
			cursor.localizationLanguages.some(
				(language, index) => language !== localizationLanguages[index],
			)
		)
			throw new InvalidPaginationCursor();
		if (!isFractionalPosition(cursor.position)) throw new InvalidPaginationCursor();
		return {
			favorite: cursor.favorite,
			position: cursor.position,
			unitId: cursor.unitId,
		};
	} catch {
		throw new InvalidPaginationCursor();
	}
}
