import { createHash } from "node:crypto";
import { t } from "elysia";

import { parseJsonCursor } from "../pagination";
import { InvalidPaginationCursor } from "../pagination/errors";
import { wilsonLowerBound } from "../tags/ranking";
import { presentBinaryVoteSummary, type BinaryVoteSummary } from "../votes/binary";
import { compareBytewisePositions } from "../ordering/position";
import type { UnitReferenceCurationKind } from "../database/schema";

interface RankedUnitReference {
	readonly id: string;
	readonly pinned: boolean;
	readonly position: string | null;
	readonly voteSummary: Pick<BinaryVoteSummary, "score" | "voteCount">;
}

interface UnitReferenceCursorContext {
	readonly unitId: string;
	readonly kind: UnitReferenceCurationKind;
	readonly curationVersion: number;
	readonly rankingVersion: string;
}

interface UnitReferenceCursorBoundary {
	readonly id: string;
	readonly pinned: boolean;
	readonly position: string | null;
	readonly score: number;
	readonly voteCount: number;
}

const UnitReferenceCursor = t.Object(
	{
		v: t.Literal(1),
		unitId: t.String({ format: "uuid" }),
		kind: t.Union([t.Literal("alias"), t.Literal("external_link")]),
		curationVersion: t.Integer({ minimum: 0 }),
		rankingVersion: t.String({ pattern: "^[0-9a-f]{64}$" }),
		id: t.String({ format: "uuid" }),
		pinned: t.Boolean(),
		position: t.Nullable(t.String({ minLength: 1 })),
		score: t.Integer(),
		voteCount: t.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);

function boundaryOf(reference: RankedUnitReference): UnitReferenceCursorBoundary {
	return {
		id: reference.id,
		pinned: reference.pinned,
		position: reference.position,
		score: reference.voteSummary.score,
		voteCount: reference.voteSummary.voteCount,
	};
}

function compareRankedReferences(
	left: UnitReferenceCursorBoundary,
	right: UnitReferenceCursorBoundary,
): number {
	if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
	if (left.pinned) {
		if (left.position === null || right.position === null)
			throw new Error("Pinned Unit reference is missing its position");
		const position = compareBytewisePositions(left.position, right.position);
		return position === 0 ? compareBytewisePositions(left.id, right.id) : position;
	}
	if (left.position !== null || right.position !== null)
		throw new Error("Unpinned Unit reference unexpectedly has a position");

	const confidence =
		wilsonLowerBound(right.score, right.voteCount) - wilsonLowerBound(left.score, left.voteCount);
	if (confidence !== 0) return confidence;
	if (left.score !== right.score) return right.score - left.score;
	if (left.voteCount !== right.voteCount) return right.voteCount - left.voteCount;
	return compareBytewisePositions(right.id, left.id);
}

function decodeUnitReferenceCursor(
	value: string | undefined,
	context: UnitReferenceCursorContext,
): UnitReferenceCursorBoundary | undefined {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, UnitReferenceCursor);
		if (
			cursor.unitId !== context.unitId ||
			cursor.kind !== context.kind ||
			cursor.curationVersion !== context.curationVersion ||
			cursor.rankingVersion !== context.rankingVersion ||
			cursor.pinned !== (cursor.position !== null)
		)
			throw new InvalidPaginationCursor();
		presentBinaryVoteSummary({
			score: cursor.score,
			voteCount: cursor.voteCount,
			viewerVote: null,
			updatedAt: null,
			name: "Unit reference cursor",
		});
		return cursor;
	} catch {
		throw new InvalidPaginationCursor();
	}
}

/** Fingerprints every value that can change reference ordering. */
export function unitReferenceRankingVersion(references: readonly RankedUnitReference[]): string {
	const hash = createHash("sha256");
	for (const reference of [...references].sort((left, right) =>
		compareBytewisePositions(left.id, right.id),
	))
		hash.update(
			JSON.stringify([
				reference.id,
				reference.pinned,
				reference.position,
				reference.voteSummary.score,
				reference.voteSummary.voteCount,
			]),
		);
	return hash.digest("hex");
}

function encodeUnitReferenceCursor(
	context: UnitReferenceCursorContext,
	boundary: UnitReferenceCursorBoundary,
): string {
	return Buffer.from(JSON.stringify({ v: 1, ...context, ...boundary })).toString("base64url");
}

/**
 * Ranks and paginates a strictly bounded active-reference set.
 *
 * At most `UnitReferenceActiveLimit + 1` rows may reach this function. The
 * cursor is still keyset-shaped so API consumers never depend on offsets.
 */
export function paginateUnitReferences<Reference extends RankedUnitReference>(input: {
	readonly references: readonly Reference[];
	readonly context: UnitReferenceCursorContext;
	readonly cursor?: string;
	readonly limit: number;
}): { readonly items: Reference[]; readonly nextCursor: string | null } {
	const boundary = decodeUnitReferenceCursor(input.cursor, input.context);
	const ordered = [...input.references].sort((left, right) =>
		compareRankedReferences(boundaryOf(left), boundaryOf(right)),
	);
	const remaining = boundary
		? ordered.filter((reference) => compareRankedReferences(boundaryOf(reference), boundary) > 0)
		: ordered;
	const items = remaining.slice(0, input.limit);
	const last = items.at(-1);
	return {
		items,
		nextCursor:
			remaining.length > items.length && last
				? encodeUnitReferenceCursor(input.context, boundaryOf(last))
				: null,
	};
}
