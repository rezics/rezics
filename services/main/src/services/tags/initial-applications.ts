import { and, eq, inArray, isNull } from "drizzle-orm";

import { TagNotFound } from "../api/tags/errors";
import type { DatabaseTransaction } from "../database";
import { tag, unit, unitTag, unitTagVote } from "../database/schema";

/** Keeps creation-time Tag validation and writes bounded independently of corpus size. */
export const InitialTagApplicationLimit = 32;

/**
 * Applies the caller's initial Tag choices and records their first positive votes atomically.
 *
 * The public API schema proves UUID syntax, uniqueness, and the bounded list length before this
 * function is called. Membership in a curated Collection is deliberately not enforced here:
 * those single- and multi-select rules are a temporary frontend creation affordance.
 */
export async function applyInitialTags(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly profileId: string;
		readonly tagIds: readonly string[];
	},
): Promise<void> {
	if (input.tagIds.length === 0) return;
	if (input.tagIds.length > InitialTagApplicationLimit)
		throw new Error("Initial Tag application limit was not enforced at the API boundary");

	const availableTags = await tx
		.select({ id: tag.id })
		.from(tag)
		.innerJoin(unit, eq(unit.id, tag.id))
		.where(
			and(
				inArray(tag.id, input.tagIds),
				eq(unit.kind, "tag"),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		);
	if (availableTags.length !== input.tagIds.length) throw new TagNotFound();

	await tx.insert(unitTag).values(
		input.tagIds.map((tagId) => ({
			unitId: input.unitId,
			tagId,
			createdByProfileId: input.profileId,
		})),
	);
	await tx.insert(unitTagVote).values(
		input.tagIds.map((tagId) => ({
			unitId: input.unitId,
			tagId,
			profileId: input.profileId,
			value: 1,
		})),
	);
}
