import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getUnitReadCondition } from "../authorization/unit/query";
import { database, type DatabaseTransaction } from "../database";
import { post, subjectAssociation, unit, unitTag, unitTagVoteStat } from "../database/schema";
import { toSafeInteger } from "../database/integer";
import { resolvedUnitLocalizationTitle } from "./localization";
import { AssociationContextPostInvalid } from "./errors";

const associationContextTagUnit = alias(unit, "association_context_tag_unit");

/**
 * Proves the cross-row invariant that a relationship context is a wiki Post.
 *
 * This intentionally does not compare the Post subject with the association
 * source Unit: variants and setting-level relationships may cite a wiki owned
 * by another Unit.
 */
export async function ensureWikiAssociationContextPost(
	tx: DatabaseTransaction,
	contextPostId: string,
): Promise<void> {
	const [contextPost] = await tx
		.select({ kind: post.kind })
		.from(post)
		.where(eq(post.id, contextPostId))
		.limit(1);
	if (contextPost?.kind !== "wiki") throw new AssociationContextPostInvalid();
}

export interface AssociationContextPostPresentation {
	id: string;
	subjectId: string | null;
	title: string | null;
	tags: {
		tagId: string;
		title: string | null;
		score: number;
		voteCount: number;
		pinned: boolean;
	}[];
}

/**
 * Batch-loads the wiki context and its current global Tag state for
 * relationship-oriented reads. Read authorization is applied in the same
 * query so inaccessible context Posts are omitted without an N+1 check.
 */
export async function getAssociationContextPostsByAssociationIds(
	associationIds: readonly string[],
	preferredLanguage?: string,
	profileId?: string,
): Promise<Map<string, AssociationContextPostPresentation>> {
	if (associationIds.length === 0) return new Map();
	const contextRows = await database
		.select({
			associationId: subjectAssociation.id,
			id: post.id,
			subjectId: post.subjectUnitId,
			title: resolvedUnitLocalizationTitle(post.id, preferredLanguage),
		})
		.from(subjectAssociation)
		.innerJoin(post, eq(post.id, subjectAssociation.contextPostId))
		.innerJoin(unit, eq(unit.id, post.id))
		.where(
			and(
				inArray(subjectAssociation.id, [...associationIds]),
				eq(post.kind, "wiki"),
				getUnitReadCondition(profileId),
			),
		);
	const postIds = [...new Set(contextRows.map((row) => row.id))];
	const tagRows =
		postIds.length === 0
			? []
			: await database
					.select({
						postId: unitTag.unitId,
						tagId: unitTag.tagId,
						title: resolvedUnitLocalizationTitle(unitTag.tagId, preferredLanguage),
						score: unitTagVoteStat.score,
						voteCount: unitTagVoteStat.voteCount,
						pinned: unitTag.pinned,
					})
					.from(unitTag)
					.innerJoin(
						associationContextTagUnit,
						eq(associationContextTagUnit.id, unitTag.tagId),
					)
					.leftJoin(
						unitTagVoteStat,
						and(
							eq(unitTagVoteStat.unitId, unitTag.unitId),
							eq(unitTagVoteStat.tagId, unitTag.tagId),
						),
					)
					.where(
						and(
							inArray(unitTag.unitId, postIds),
							getUnitReadCondition(profileId, {}, associationContextTagUnit),
						),
					)
					.orderBy(unitTag.unitId, unitTag.position, unitTag.tagId);
	const tagsByPostId = new Map<string, AssociationContextPostPresentation["tags"][number][]>();
	for (const row of tagRows) {
		const tags = tagsByPostId.get(row.postId) ?? [];
		tags.push({
			tagId: row.tagId,
			title: row.title,
			score: toSafeInteger(row.score ?? 0n, "association context tag vote score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "association context tag vote count"),
			pinned: row.pinned,
		});
		tagsByPostId.set(row.postId, tags);
	}
	return new Map(
		contextRows.map((row) => [
			row.associationId,
			{
				id: row.id,
				subjectId: row.subjectId,
				title: row.title,
				tags: tagsByPostId.get(row.id) ?? [],
			},
		]),
	);
}
