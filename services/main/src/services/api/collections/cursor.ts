import { t } from "elysia";

import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { ContentLanguage, Uuid } from "../schema";
import type { ListCollectionsQuery } from "./schema";

const CollectionListCursor = t.Object(
	{
		v: t.Literal(1),
		publisherProfileId: t.Nullable(Uuid),
		editableOnly: t.Boolean(),
		targetId: t.Nullable(Uuid),
		containsTargetId: t.Nullable(Uuid),
		acceptsItemsOnly: t.Boolean(),
		localizationLanguages: t.Array(ContentLanguage, {
			maxItems: 50,
			uniqueItems: true,
		}),
		search: t.Nullable(t.String({ minLength: 1, maxLength: 200 })),
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		favoritesRank: t.Integer({ minimum: 0, maximum: 1 }),
		updatedAt: t.String({ format: "date-time" }),
		id: Uuid,
	},
	{ additionalProperties: false },
);

interface CollectionListCursorContext {
	readonly query: ListCollectionsQuery;
}

export interface CollectionListCursorBoundary {
	readonly favoritesRank: number;
	readonly updatedAt: Date;
	readonly id: string;
}

function normalizedSearch(query: ListCollectionsQuery): string | null {
	return query.search?.trim() || null;
}

function equalOrderedValues(left: readonly string[], right: readonly string[]) {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function decodeCollectionListCursor(
	value: string | undefined,
	context: CollectionListCursorContext,
): CollectionListCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, CollectionListCursor);
		if (
			cursor.publisherProfileId !== (context.query.publisherProfileId ?? null) ||
			cursor.editableOnly !== Boolean(context.query.editableOnly) ||
			cursor.targetId !== (context.query.targetId ?? null) ||
			cursor.containsTargetId !== (context.query.containsTargetId ?? null) ||
			cursor.acceptsItemsOnly !== Boolean(context.query.acceptsItemsOnly) ||
			!equalOrderedValues(
				cursor.localizationLanguages,
				context.query.localizationLanguages ?? [],
			) ||
			cursor.search !== normalizedSearch(context.query) ||
			cursor.limit !== (context.query.limit ?? 20)
		)
			throw new InvalidPaginationCursor();
		const updatedAt = new Date(cursor.updatedAt);
		if (Number.isNaN(updatedAt.getTime())) throw new InvalidPaginationCursor();
		return { favoritesRank: cursor.favoritesRank, updatedAt, id: cursor.id };
	} catch {
		throw new InvalidPaginationCursor();
	}
}

export function encodeCollectionListCursor(
	boundary: CollectionListCursorBoundary,
	context: CollectionListCursorContext,
): string {
	return Buffer.from(
		JSON.stringify({
			v: 1,
			publisherProfileId: context.query.publisherProfileId ?? null,
			editableOnly: Boolean(context.query.editableOnly),
			targetId: context.query.targetId ?? null,
			containsTargetId: context.query.containsTargetId ?? null,
			acceptsItemsOnly: Boolean(context.query.acceptsItemsOnly),
			localizationLanguages: context.query.localizationLanguages ?? [],
			search: normalizedSearch(context.query),
			limit: context.query.limit ?? 20,
			favoritesRank: boundary.favoritesRank,
			updatedAt: boundary.updatedAt.toISOString(),
			id: boundary.id,
		}),
	).toString("base64url");
}
