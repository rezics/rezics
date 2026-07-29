import { t } from "elysia";

import { parseJsonCursor } from "../../pagination";
import { InvalidPaginationCursor } from "../../pagination/errors";
import { ContentLanguage, Uuid } from "../schema";
import type { ListCollectionsQuery } from "./schema";

const CollectionListCursor = t.Object(
	{
		v: t.Literal(1),
		ownerId: t.Nullable(Uuid),
		targetId: t.Nullable(Uuid),
		containsTargetId: t.Nullable(Uuid),
		acceptsItemsOnly: t.Boolean(),
		localizationLanguages: t.Array(ContentLanguage, {
			maxItems: 50,
			uniqueItems: true,
		}),
		search: t.Nullable(t.String({ minLength: 1, maxLength: 200 })),
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		ownerListing: t.Boolean(),
		systemRank: t.Integer({ minimum: 0, maximum: 1 }),
		updatedAt: t.String({ format: "date-time" }),
		id: Uuid,
	},
	{ additionalProperties: false },
);

interface CollectionListCursorContext {
	readonly ownerListing: boolean;
	readonly query: ListCollectionsQuery;
}

export interface CollectionListCursorBoundary {
	readonly systemRank: number;
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
			cursor.ownerId !== (context.query.ownerId ?? null) ||
			cursor.targetId !== (context.query.targetId ?? null) ||
			cursor.containsTargetId !== (context.query.containsTargetId ?? null) ||
			cursor.acceptsItemsOnly !== Boolean(context.query.acceptsItemsOnly) ||
			!equalOrderedValues(
				cursor.localizationLanguages,
				context.query.localizationLanguages ?? [],
			) ||
			cursor.search !== normalizedSearch(context.query) ||
			cursor.limit !== (context.query.limit ?? 20) ||
			cursor.ownerListing !== context.ownerListing
		)
			throw new InvalidPaginationCursor();
		const updatedAt = new Date(cursor.updatedAt);
		if (Number.isNaN(updatedAt.getTime())) throw new InvalidPaginationCursor();
		return { systemRank: cursor.systemRank, updatedAt, id: cursor.id };
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
			ownerId: context.query.ownerId ?? null,
			targetId: context.query.targetId ?? null,
			containsTargetId: context.query.containsTargetId ?? null,
			acceptsItemsOnly: Boolean(context.query.acceptsItemsOnly),
			localizationLanguages: context.query.localizationLanguages ?? [],
			search: normalizedSearch(context.query),
			limit: context.query.limit ?? 20,
			ownerListing: context.ownerListing,
			systemRank: boundary.systemRank,
			updatedAt: boundary.updatedAt.toISOString(),
			id: boundary.id,
		}),
	).toString("base64url");
}
