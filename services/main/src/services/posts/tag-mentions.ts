import { collectPortableTextUnitMentionIds } from "@rezics/portable-text";
import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { tag, unitTag, unitTagVote } from "../database/schema";
import { PostTagMentionVoteConflict } from "./errors";

export function collectNewPostUnitMentionIds(previousBody: unknown, nextBody: unknown): string[] {
	const previousIds = new Set(collectPortableTextUnitMentionIds(previousBody));
	return collectPortableTextUnitMentionIds(nextBody).filter((id) => !previousIds.has(id));
}

/**
 * Applies the additive side effect of newly inserted Tag mentions.
 *
 * Removing a mention never retracts a vote. An existing +1 vote is idempotent;
 * an existing -1 vote is respected and fails the surrounding content
 * transaction instead of silently reversing an explicit preference.
 */
export async function applyNewPostTagMentionVotes(
	tx: DatabaseTransaction,
	input: {
		readonly postId: string;
		readonly profileId: string;
		readonly previousBody?: unknown;
		readonly nextBody: unknown;
	},
): Promise<void> {
	const addedMentionIds = collectNewPostUnitMentionIds(input.previousBody, input.nextBody);
	if (addedMentionIds.length === 0) return;

	const mentionedTags = await tx
		.select({ id: tag.id })
		.from(tag)
		.where(inArray(tag.id, addedMentionIds));

	for (const { id: tagId } of mentionedTags.sort((left, right) =>
		left.id.localeCompare(right.id),
	)) {
		await tx
			.insert(unitTag)
			.values({
				unitId: input.postId,
				tagId,
				createdByProfileId: input.profileId,
			})
			.onConflictDoNothing();
		const [createdVote] = await tx
			.insert(unitTagVote)
			.values({
				unitId: input.postId,
				tagId,
				profileId: input.profileId,
				value: 1,
			})
			.onConflictDoNothing()
			.returning({ value: unitTagVote.value });
		if (createdVote) continue;

		const [existingVote] = await tx
			.select({ value: unitTagVote.value })
			.from(unitTagVote)
			.where(
				and(
					eq(unitTagVote.unitId, input.postId),
					eq(unitTagVote.tagId, tagId),
					eq(unitTagVote.profileId, input.profileId),
				),
			)
			.for("update")
			.limit(1);
		if (existingVote?.value === -1) throw new PostTagMentionVoteConflict();
		if (existingVote?.value !== 1)
			throw new Error("Tag mention vote conflict did not resolve to a stored vote");
	}
}
