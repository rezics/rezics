import { collectPortableTextUnitMentionIds } from "@rezics/portable-text";
import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import { tag, unitTag, unitTagJudgment } from "../database/schema";
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
		const fitUpdatedAt = new Date();
		await tx
			.insert(unitTag)
			.values({
				unitId: input.postId,
				tagId,
				createdByProfileId: input.profileId,
			})
			.onConflictDoNothing();
		const [createdVote] = await tx
			.insert(unitTagJudgment)
			.values({
				unitId: input.postId,
				tagId,
				profileId: input.profileId,
				fitVote: 1,
				fitUpdatedAt,
			})
			.onConflictDoNothing()
			.returning({ value: unitTagJudgment.fitVote });
		if (createdVote) continue;

		const [existingVote] = await tx
			.select({ value: unitTagJudgment.fitVote })
			.from(unitTagJudgment)
			.where(
				and(
					eq(unitTagJudgment.unitId, input.postId),
					eq(unitTagJudgment.tagId, tagId),
					eq(unitTagJudgment.profileId, input.profileId),
				),
			)
			.for("update")
			.limit(1);
		if (existingVote?.value === -1) throw new PostTagMentionVoteConflict();
		if (existingVote?.value === null) {
			await tx
				.update(unitTagJudgment)
				.set({ fitVote: 1, fitUpdatedAt })
				.where(
					and(
						eq(unitTagJudgment.unitId, input.postId),
						eq(unitTagJudgment.tagId, tagId),
						eq(unitTagJudgment.profileId, input.profileId),
					),
				);
			continue;
		}
		if (existingVote?.value !== 1)
			throw new Error("Tag mention vote conflict did not resolve to a stored vote");
	}
}
