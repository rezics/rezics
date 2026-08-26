import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";
import { createCommunityOwnedUnitAccess } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { runVoteTransaction } from "../database/vote-admission";
import { databaseConstraintName } from "../database/constraint";
import { toSafeInteger } from "../database/integer";
import {
	tagPathEdge,
	tagPathMember,
	tag,
	unit,
	tagPath,
	tagPathMerge,
	unitTagPath,
	unitTagPathJudgment,
	unitTagPathJudgmentStat,
	tagPathVote,
	tagPathVoteStat,
	realm,
	realmUnit,
	realmTagPath,
	realmTagPathVote,
	realmTagPathVoteStat,
	realmUnitTagPath,
	realmUnitTagPathJudgment,
	realmUnitTagPathJudgmentStat,
	TagPathMaximumMembers,
	TagPathMinimumMembers,
} from "../database/schema";
import { insertUnit } from "../units/create";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";
import { presentAvatar } from "../units/avatar";
import {
	InvalidTagPath,
	InvalidTagPathMerge,
	TagNotFound,
	TagPathApplicationNotFound,
	TagPathDefinitionConflict,
	TagPathMergeNotFound,
	TagPathNotFound,
} from "../api/tags/errors";
import { RealmNotFound } from "../api/realms/errors";
import { wilsonLowerBound, wilsonLowerBoundSql } from "../tags/ranking";
import { decomposeTagCompoundQuery } from "../search/query-expansion";
import { peekActiveObservability } from "@rezics/observability";

export type BinaryVote = -1 | 1;
export type OptionalBinaryVote = BinaryVote | null;
type SpoilerLevel = 0 | 1 | 2;

type TagHierarchyAuthorization = {
	readonly ensureCanRead: (unitId: string, onDenied: () => TagNotFound) => Promise<void>;
};

export function toTagPathConstraintError(error: unknown): InvalidTagPath | undefined {
	const constraint = databaseConstraintName(error);
	if (
		constraint?.startsWith("tag_path_") ||
		constraint?.startsWith("unit_tag_path_") ||
		constraint === "unit_effective_tag_not_self_check"
	)
		return new InvalidTagPath();
	const visited = new Set<unknown>();
	let current = error;
	while (current && typeof current === "object" && !visited.has(current)) {
		visited.add(current);
		const code = Reflect.get(current, "code");
		const message = Reflect.get(current, "message");
		if (
			(code === "23514" || code === "55000") &&
			typeof message === "string" &&
			/path|Tag hierarchy path/i.test(message)
		)
			return new InvalidTagPath();
		current = Reflect.get(current, "cause");
	}
	return undefined;
}

const memberUnit = alias(unit, "tag_path_member_unit");
const hierarchyChildUnit = alias(unit, "tag_hierarchy_child_unit");
const viewerDefinitionVote = alias(tagPathVote, "viewer_tag_path_vote");
const viewerApplicationVote = alias(unitTagPathJudgment, "viewer_tag_path_application_vote");
const viewerRealmDefinitionVote = alias(realmTagPathVote, "viewer_realm_tag_path_vote");
const viewerRealmApplicationJudgment = alias(
	realmUnitTagPathJudgment,
	"viewer_realm_unit_tag_path_judgment",
);
const acceptedMerge = alias(tagPathMerge, "accepted_tag_path_merge");
const applicationWilsonConfidence = wilsonLowerBoundSql(
	unitTagPathJudgmentStat.score,
	unitTagPathJudgmentStat.voteCount,
);

function presentVote(value: number | null): OptionalBinaryVote {
	if (value === null || value === -1 || value === 1) return value;
	throw new Error("Stored Tag path vote has an invalid value");
}

function tagPathDefinitionKey(memberTagIds: readonly string[]): string {
	return JSON.stringify(memberTagIds);
}

function validateMemberTagIds(memberTagIds: readonly string[]): void {
	if (
		memberTagIds.length < TagPathMinimumMembers ||
		memberTagIds.length > TagPathMaximumMembers ||
		new Set(memberTagIds).size !== memberTagIds.length
	)
		throw new InvalidTagPath();
}

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((id, index) => id === right[index]);
}

async function ensureCreatableTags(
	tx: DatabaseTransaction,
	memberTagIds: readonly string[],
): Promise<void> {
	const rows = await tx
		.select({ id: tag.id })
		.from(tag)
		.innerJoin(unit, eq(unit.id, tag.id))
		.where(
			and(
				inArray(tag.id, [...memberTagIds]),
				eq(unit.kind, "tag"),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		);
	if (rows.length !== memberTagIds.length) throw new TagNotFound();
}

async function upsertDefinitionVote(
	tx: DatabaseTransaction,
	pathId: string,
	profileId: string,
	value: BinaryVote,
	createdAt?: Date,
): Promise<void> {
	await tx
		.insert(tagPathVote)
		.values({ pathId, profileId, value, createdAt, updatedAt: createdAt })
		.onConflictDoUpdate({
			target: [tagPathVote.pathId, tagPathVote.profileId],
			set: { value, updatedAt: new Date() },
		});
}

export interface CreateTagPathInput {
	readonly pathId?: string;
	readonly memberTagIds: readonly string[];
	readonly profileId: string;
	readonly createdAt?: Date;
}

export async function createTagPathInTransaction(
	tx: DatabaseTransaction,
	input: CreateTagPathInput,
): Promise<{ readonly pathId: string; readonly created: boolean }> {
	validateMemberTagIds(input.memberTagIds);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${tagPathDefinitionKey(input.memberTagIds)}, 0))`,
	);
	await ensureCreatableTags(tx, input.memberTagIds);
	if (input.pathId) {
		const [declaredIdentity] = await tx
			.select({
				id: unit.id,
				unitKind: unit.kind,
				memberTagIds: tagPath.memberTagIds,
			})
			.from(unit)
			.leftJoin(tagPath, eq(tagPath.id, unit.id))
			.where(eq(unit.id, input.pathId))
			.limit(1);
		if (declaredIdentity) {
			if (
				declaredIdentity.unitKind !== "tag_path" ||
				!declaredIdentity.memberTagIds ||
				!sameOrderedIds(declaredIdentity.memberTagIds, input.memberTagIds)
			)
				throw new TagPathDefinitionConflict(input.pathId);
			await upsertDefinitionVote(tx, input.pathId, input.profileId, 1, input.createdAt);
			return { pathId: input.pathId, created: false };
		}
	}
	const [existing] = await tx
		.select({ id: tagPath.id })
		.from(tagPath)
		.where(eq(tagPath.memberTagIds, [...input.memberTagIds]))
		.limit(1);
	if (existing) {
		await upsertDefinitionVote(tx, existing.id, input.profileId, 1, input.createdAt);
		return { pathId: existing.id, created: false };
	}

	const createdAt = input.createdAt ?? new Date();
	const created = await insertUnit(tx, {
		id: input.pathId,
		kind: "tag_path",
		status: "published",
		visibility: "public",
		publishedAt: createdAt,
		createdAt,
		updatedAt: createdAt,
		statusActor: { kind: "profile", profileId: input.profileId },
	});
	await tx.insert(tagPath).values({
		id: created.id,
		memberTagIds: [...input.memberTagIds],
		terminalTagId: input.memberTagIds.at(-1)!,
		createdByProfileId: input.profileId,
		createdAt,
	});
	await createCommunityOwnedUnitAccess(tx, created.id);
	await upsertDefinitionVote(tx, created.id, input.profileId, 1, createdAt);
	return { pathId: created.id, created: true };
}

export async function createTagPath(
	input: CreateTagPathInput,
): Promise<{ readonly pathId: string; readonly created: boolean }> {
	return runVoteTransaction({ family: "tag_path", authority: "global" }, (tx) =>
		createTagPathInTransaction(tx, input),
	);
}

function isOrderedSuffix(longer: readonly string[], shorter: readonly string[]): boolean {
	if (shorter.length > longer.length) return false;
	const offset = longer.length - shorter.length;
	return shorter.every((id, index) => longer[offset + index] === id);
}

/**
 * Finds bounded, accepted definitions that a curator should review before
 * creating another immutable Path ending at the same Tag.
 */
export async function listTagPathDefinitionWarnings(input: {
	readonly memberTagIds: readonly string[];
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	validateMemberTagIds(input.memberTagIds);
	const terminalTagId = input.memberTagIds.at(-1)!;
	const rows = await database
		.select({
			pathId: tagPath.id,
			memberTagIds: tagPath.memberTagIds,
			usageCount: tagPathVoteStat.usageCount,
		})
		.from(tagPath)
		.innerJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.innerJoin(unit, eq(unit.id, tagPath.id))
		.where(
			and(
				eq(tagPath.terminalTagId, terminalTagId),
				gt(tagPathVoteStat.score, 0n),
				gt(tagPathVoteStat.voteCount, 0n),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				sql`not exists (
					select 1 from ${tagPathMerge} merge
					where merge.source_path_id = ${tagPath.id} and merge.status = 'accepted'
				)`,
			),
		)
		.orderBy(desc(tagPathVoteStat.usageCount), tagPath.id)
		.limit(input.limit);
	const distinctRows = rows.filter((row) => !sameOrderedIds(row.memberTagIds, input.memberTagIds));
	const members = await listPathMembers(
		distinctRows.map(({ pathId }) => pathId),
		input.localizationLanguages,
	);
	return distinctRows.map((row) => ({
		pathId: row.pathId,
		relation: isOrderedSuffix(input.memberTagIds, row.memberTagIds)
			? ("existing_shorter_suffix" as const)
			: isOrderedSuffix(row.memberTagIds, input.memberTagIds)
				? ("existing_longer_extension" as const)
				: ("same_terminal" as const),
		usageCount: toSafeInteger(row.usageCount, "Tag path warning usage count"),
		members: members.get(row.pathId) ?? [],
	}));
}

async function getDefinitionVoteSummary(pathId: string, viewerVote: OptionalBinaryVote) {
	const [row] = await database
		.select({
			score: tagPathVoteStat.score,
			voteCount: tagPathVoteStat.voteCount,
		})
		.from(tagPath)
		.leftJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.where(eq(tagPath.id, pathId))
		.limit(1);
	if (!row) throw new TagPathNotFound();
	return {
		score: toSafeInteger(row.score ?? 0n, "Tag path score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Tag path vote count"),
		viewerVote,
	};
}

export async function voteTagPath(input: {
	readonly pathId: string;
	readonly profileId: string;
	readonly value: BinaryVote;
}) {
	const updated = await runVoteTransaction(
		{ family: "tag_path", authority: "global" },
		async (tx) => {
			const [existing] = await tx
				.select({ id: tagPath.id })
				.from(tagPath)
				.where(eq(tagPath.id, input.pathId))
				.limit(1);
			if (!existing) throw new TagPathNotFound();
			await upsertDefinitionVote(tx, input.pathId, input.profileId, input.value);
			return input.value;
		},
	);
	return getDefinitionVoteSummary(input.pathId, updated);
}

export async function deleteTagPathVote(input: {
	readonly pathId: string;
	readonly profileId: string;
}) {
	await runVoteTransaction({ family: "tag_path", authority: "global" }, async (tx) => {
		const [existing] = await tx
			.select({ id: tagPath.id })
			.from(tagPath)
			.where(eq(tagPath.id, input.pathId))
			.limit(1);
		if (!existing) throw new TagPathNotFound();
		await tx
			.delete(tagPathVote)
			.where(and(eq(tagPathVote.pathId, input.pathId), eq(tagPathVote.profileId, input.profileId)));
	});
	return getDefinitionVoteSummary(input.pathId, null);
}

export async function listPathMembers(
	pathIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
) {
	if (pathIds.length === 0) return new Map<string, TagPathMember[]>();
	const rows = await database
		.select({
			pathId: tagPathMember.pathId,
			ordinal: tagPathMember.ordinal,
			tagId: tagPathMember.tagId,
			language: resolvedUnitLocalizationLanguage(memberUnit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(memberUnit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(memberUnit.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(memberUnit.id, localizationLanguages),
		})
		.from(tagPathMember)
		.innerJoin(memberUnit, eq(memberUnit.id, tagPathMember.tagId))
		.where(inArray(tagPathMember.pathId, [...pathIds]))
		.orderBy(tagPathMember.pathId, tagPathMember.ordinal);
	const grouped = new Map<string, TagPathMember[]>();
	for (const row of rows) {
		const items = grouped.get(row.pathId) ?? [];
		items.push({
			ordinal: row.ordinal,
			tagId: row.tagId,
			language: row.language,
			title: row.title,
			summary: row.summary,
			avatar: presentAvatar(row.avatar),
		});
		grouped.set(row.pathId, items);
	}
	return grouped;
}

export type TagPathMember = {
	readonly ordinal: number;
	readonly tagId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: ReturnType<typeof presentAvatar>;
};

export async function getTagPath(input: {
	readonly pathId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
}) {
	const [record] = await database
		.select({
			id: tagPath.id,
			terminalTagId: tagPath.terminalTagId,
			createdByProfileId: tagPath.createdByProfileId,
			score: tagPathVoteStat.score,
			voteCount: tagPathVoteStat.voteCount,
			usageCount: tagPathVoteStat.usageCount,
			viewerVote: viewerDefinitionVote.value,
			createdAt: tagPath.createdAt,
			updatedAt: unit.updatedAt,
			mergedIntoPathId: acceptedMerge.targetPathId,
		})
		.from(tagPath)
		.innerJoin(unit, eq(unit.id, tagPath.id))
		.leftJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.leftJoin(
			viewerDefinitionVote,
			and(
				eq(viewerDefinitionVote.pathId, tagPath.id),
				input.viewerProfileId
					? eq(viewerDefinitionVote.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.leftJoin(
			acceptedMerge,
			and(eq(acceptedMerge.sourcePathId, tagPath.id), eq(acceptedMerge.status, "accepted")),
		)
		.where(
			and(
				eq(tagPath.id, input.pathId),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				sql`not exists (
					select 1
					from ${tagPathMember} member
					join unit member_unit on member_unit.id = member.tag_id
					where member.path_id = ${tagPath.id}
						and (
							member_unit.kind <> 'tag'
							or member_unit.status <> 'published'
							or member_unit.visibility <> 'public'
							or member_unit.moderation_status <> 'approved'
							or member_unit.deleted_at is not null
						)
				)`,
			),
		)
		.limit(1);
	if (!record) throw new TagPathNotFound();
	const members = await listPathMembers([record.id], input.localizationLanguages);
	return {
		...record,
		score: toSafeInteger(record.score ?? 0n, "Tag path score"),
		voteCount: toSafeInteger(record.voteCount ?? 0n, "Tag path vote count"),
		usageCount: toSafeInteger(record.usageCount ?? 0n, "Tag path usage count"),
		viewerVote: presentVote(record.viewerVote),
		members: members.get(record.id) ?? [],
	};
}

export interface ProposeTagPathMergeInput {
	readonly sourcePathId: string;
	readonly targetPathId: string;
	readonly reason: string;
	readonly profileId: string;
	readonly proposalSource:
		| { readonly kind: "human" }
		| {
				readonly kind: "assisted";
				readonly system: string;
				readonly runId: string;
				readonly model?: string;
				readonly confidence?: number;
		  };
}

export async function proposeTagPathMerge(input: ProposeTagPathMergeInput) {
	const reason = input.reason.trim();
	if (!reason || input.sourcePathId === input.targetPathId) throw new InvalidTagPathMerge();
	return database.transaction(async (tx) => {
		const paths = await tx
			.select({ id: tagPath.id })
			.from(tagPath)
			.where(inArray(tagPath.id, [input.sourcePathId, input.targetPathId]));
		if (paths.length !== 2) throw new TagPathNotFound();
		const [created] = await tx
			.insert(tagPathMerge)
			.values({
				sourcePathId: input.sourcePathId,
				targetPathId: input.targetPathId,
				reason,
				proposalSourceKind: input.proposalSource.kind,
				proposalProvenance: input.proposalSource.kind === "assisted" ? input.proposalSource : null,
				proposedByProfileId: input.profileId,
			})
			.returning({
				id: tagPathMerge.id,
				status: tagPathMerge.status,
				proposalSourceKind: tagPathMerge.proposalSourceKind,
				proposalProvenance: tagPathMerge.proposalProvenance,
				createdAt: tagPathMerge.createdAt,
			});
		if (!created) throw new Error("Tag Path merge proposal insertion returned no row");
		return {
			id: created.id,
			sourcePathId: input.sourcePathId,
			targetPathId: input.targetPathId,
			status: created.status,
			proposalSource: presentTagPathMergeProposalSource(
				created.proposalSourceKind,
				created.proposalProvenance,
			),
			createdAt: created.createdAt,
		};
	});
}

function presentTagPathMergeProposalSource(
	kind: "human" | "assisted",
	provenance: {
		readonly kind: "assisted";
		readonly system: string;
		readonly runId: string;
		readonly model?: string;
		readonly confidence?: number;
	} | null,
) {
	if (kind === "human") return { kind } as const;
	if (
		!provenance ||
		provenance.kind !== "assisted" ||
		typeof provenance.system !== "string" ||
		typeof provenance.runId !== "string"
	)
		throw new Error("Stored assisted Tag Path proposal has invalid provenance");
	return provenance;
}

/** Returns the oldest unresolved manual merge proposals from the indexed governance queue. */
export async function listPendingTagPathMerges(input: {
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const rows = await database
		.select({
			id: tagPathMerge.id,
			sourcePathId: tagPathMerge.sourcePathId,
			targetPathId: tagPathMerge.targetPathId,
			reason: tagPathMerge.reason,
			proposalSourceKind: tagPathMerge.proposalSourceKind,
			proposalProvenance: tagPathMerge.proposalProvenance,
			proposedByProfileId: tagPathMerge.proposedByProfileId,
			createdAt: tagPathMerge.createdAt,
		})
		.from(tagPathMerge)
		.where(eq(tagPathMerge.status, "proposed"))
		.orderBy(tagPathMerge.createdAt, tagPathMerge.id)
		.limit(input.limit);
	const pathIds = [
		...new Set(rows.flatMap(({ sourcePathId, targetPathId }) => [sourcePathId, targetPathId])),
	];
	const members = await listPathMembers(pathIds, input.localizationLanguages);
	const now = Date.now();
	return {
		items: rows.map((row) => ({
			...row,
			status: "proposed" as const,
			proposalSource: presentTagPathMergeProposalSource(
				row.proposalSourceKind,
				row.proposalProvenance,
			),
			ageSeconds: Math.max(0, Math.floor((now - row.createdAt.getTime()) / 1_000)),
			sourceMembers: members.get(row.sourcePathId) ?? [],
			targetMembers: members.get(row.targetPathId) ?? [],
		})),
	};
}

async function ensureMergeDoesNotCycle(
	tx: DatabaseTransaction,
	sourcePathId: string,
	targetPathId: string,
): Promise<void> {
	const result = await tx.execute<{ readonly pathId: string; readonly depth: number }>(sql`
		with recursive merge_chain(path_id, depth) as (
			select ${targetPathId}::uuid, 0
			union all
			select merge.target_path_id, merge_chain.depth + 1
			from merge_chain
			join ${tagPathMerge} merge
				on merge.source_path_id = merge_chain.path_id
				and merge.status = 'accepted'
			where merge_chain.depth < ${TagPathMaximumMembers}
		)
		select path_id as "pathId", depth
		from merge_chain
	`);
	if (
		result.rows.some(({ pathId }) => pathId === sourcePathId) ||
		result.rows.some(({ depth }) => depth >= TagPathMaximumMembers)
	)
		throw new InvalidTagPathMerge();
}

export async function resolveTagPathMerge(input: {
	readonly mergeId: string;
	readonly resolution: "accepted" | "rejected" | "reversed";
	readonly profileId: string;
}) {
	const result = await database.transaction(async (tx) => {
		const [proposal] = await tx
			.select({
				id: tagPathMerge.id,
				sourcePathId: tagPathMerge.sourcePathId,
				targetPathId: tagPathMerge.targetPathId,
				status: tagPathMerge.status,
				proposalSourceKind: tagPathMerge.proposalSourceKind,
				proposalProvenance: tagPathMerge.proposalProvenance,
				createdAt: tagPathMerge.createdAt,
			})
			.from(tagPathMerge)
			.where(eq(tagPathMerge.id, input.mergeId))
			.limit(1);
		if (!proposal) throw new TagPathMergeNotFound();
		const lockIds = [proposal.sourcePathId, proposal.targetPathId].toSorted();
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`tag_path_merge:${lockIds[0]}`}, 0)),
				pg_advisory_xact_lock(hashtextextended(${`tag_path_merge:${lockIds[1]}`}, 0))`,
		);
		if (
			(input.resolution === "reversed" && proposal.status !== "accepted") ||
			(input.resolution !== "reversed" && proposal.status !== "proposed")
		)
			throw new InvalidTagPathMerge();
		if (input.resolution === "accepted")
			await ensureMergeDoesNotCycle(tx, proposal.sourcePathId, proposal.targetPathId);
		const resolvedAt = new Date();
		const [updated] = await tx
			.update(tagPathMerge)
			.set({
				status: input.resolution,
				resolvedByProfileId: input.profileId,
				resolvedAt,
				updatedAt: resolvedAt,
			})
			.where(eq(tagPathMerge.id, proposal.id))
			.returning({
				id: tagPathMerge.id,
				status: tagPathMerge.status,
				resolvedAt: tagPathMerge.resolvedAt,
			});
		if (!updated) throw new TagPathMergeNotFound();
		return {
			...updated,
			sourcePathId: proposal.sourcePathId,
			targetPathId: proposal.targetPathId,
			proposalSource: presentTagPathMergeProposalSource(
				proposal.proposalSourceKind,
				proposal.proposalProvenance,
			),
			createdAt: proposal.createdAt,
		};
	});
	peekActiveObservability()?.metrics.tagPathGovernanceDecisionLatency(
		Math.max(0, result.resolvedAt!.getTime() - result.createdAt.getTime()),
		input.resolution,
	);
	return result;
}

/**
 * Ranks accepted Tag Paths for transient search and display ordering.
 *
 * @remarks
 * The current weight is accepted active usage count only. The result is not a
 * canonical or manually selected primary Path and must not be persisted as one.
 *
 * @todo Replace the provisional usage-count-only weight with the separately
 * adopted final ranking formula.
 */
export async function listRankedTagPathsEndingAt(input: {
	readonly tagId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const rows = await database
		.select({
			pathId: tagPath.id,
			usageCount: tagPathVoteStat.usageCount,
			score: tagPathVoteStat.score,
			voteCount: tagPathVoteStat.voteCount,
		})
		.from(tagPath)
		.innerJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.where(
			and(
				eq(tagPath.terminalTagId, input.tagId),
				gt(tagPathVoteStat.score, 0n),
				gt(tagPathVoteStat.voteCount, 0n),
				sql`not exists (
					select 1 from ${tagPathMerge} merge
					where merge.source_path_id = ${tagPath.id} and merge.status = 'accepted'
				)`,
			),
		)
		.orderBy(desc(tagPathVoteStat.usageCount), tagPath.id)
		.limit(input.limit);
	const members = await listPathMembers(
		rows.map(({ pathId }) => pathId),
		input.localizationLanguages,
	);
	return rows.map((row) => ({
		pathId: row.pathId,
		usageCount: toSafeInteger(row.usageCount, "Tag Path usage count"),
		score: toSafeInteger(row.score, "Tag Path score"),
		voteCount: toSafeInteger(row.voteCount, "Tag Path vote count"),
		members: members.get(row.pathId) ?? [],
	}));
}

const TagCompoundCandidateLimit = 8 as const;
const TagCompoundPostingBudget = 4_000 as const;

/**
 * Resolves compound Tag input to accepted Paths while returning terminal Tags.
 *
 * @remarks
 * Candidate generation reuses the bounded PGroonga Tag index and never copies
 * ancestor text into descendant search documents. Path order is provisional:
 * accepted active usage count is the weight, with forward order only breaking
 * equal-weight matches ahead of reverse-order matches.
 *
 * @todo Replace the usage-count-only weight with the separately adopted final
 * search ranking formula.
 */
export async function suggestTagsFromCompoundPath(input: {
	readonly query: string;
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly limit: number;
}) {
	const decompositions = decomposeTagCompoundQuery(input.query);
	if (!decompositions.length) return [];
	const fragments = [...new Set(decompositions.flatMap(({ parts }) => [...parts]))];
	const candidates = await database.execute<{
		readonly fragment: string;
		readonly tagId: string;
	}>(sql`
		select fragment.value as fragment, candidate.unit_id as "tagId"
		from unnest(${fragments}::text[]) as fragment(value)
		cross join lateral public.search_text_candidates(
			array[fragment.value]::text[],
			${input.localizationLanguages ?? []}::text[],
			'tag',
			null,
			null,
			${TagCompoundPostingBudget},
			${TagCompoundCandidateLimit}
		) candidate
		where candidate.search_matched
	`);
	const candidateIds = new Map<string, string[]>();
	for (const row of candidates.rows) {
		const ids = candidateIds.get(row.fragment) ?? [];
		if (!ids.includes(row.tagId)) ids.push(row.tagId);
		candidateIds.set(row.fragment, ids);
	}
	const viable = decompositions.flatMap(({ parts }, decompositionIndex) => {
		const ids = parts.map((part) => candidateIds.get(part) ?? []);
		return ids.every((values) => values.length) ? [{ decompositionIndex, parts, ids }] : [];
	});
	if (!viable.length) return [];
	const branch = (item: (typeof viable)[number], direction: "forward" | "reverse") => {
		const anchorIds = item.ids[0]!;
		const memberConditions = item.ids.slice(1).map(
			(ids, offset) => sql`exists (
				select 1
				from ${tagPathMember} matched_member
				where matched_member.path_id = anchor.path_id
					and matched_member.ordinal = anchor.ordinal
						${direction === "forward" ? sql`+ ${offset + 1}` : sql`- ${offset + 1}`}
					and matched_member.tag_id = any(${ids}::uuid[])
			)`,
		);
		return sql`
			select anchor.path_id as "pathId",
				${direction}::text as direction,
				${item.decompositionIndex}::integer as "decompositionIndex",
				${item.parts.length}::integer as "matchedPartCount",
				${tagPathVoteStat.usageCount} as "usageCount",
				${tagPathVoteStat.score} as score,
				${tagPathVoteStat.voteCount} as "voteCount"
			from ${tagPathMember} anchor
			inner join ${tagPath} on ${tagPath.id} = anchor.path_id
			inner join ${unit} path_unit on path_unit.id = ${tagPath.id}
			inner join ${tagPathVoteStat} on ${tagPathVoteStat.pathId} = ${tagPath.id}
			where anchor.tag_id = any(${anchorIds}::uuid[])
				and ${tagPathVoteStat.score} > 0
				and ${tagPathVoteStat.voteCount} > 0
				and path_unit.status = 'published'
				and path_unit.visibility = 'public'
				and path_unit.moderation_status = 'approved'
				and path_unit.deleted_at is null
				and ${sql.join(memberConditions, sql` and `)}
				and not exists (
					select 1 from ${tagPathMerge} merge
					where merge.source_path_id = ${tagPath.id}
						and merge.status = 'accepted'
				)
		`;
	};
	const branches = viable.flatMap((item) => [branch(item, "forward"), branch(item, "reverse")]);
	const matched = await database.execute<{
		readonly pathId: string;
		readonly direction: "forward" | "reverse";
		readonly decompositionIndex: number;
		readonly matchedPartCount: number;
		readonly usageCount: bigint;
		readonly score: bigint;
		readonly voteCount: bigint;
	}>(sql`
		select distinct on (matched_path."pathId")
			matched_path.*
		from (${sql.join(
			branches.map((item) => sql`(${item})`),
			sql` union all `,
		)}) matched_path
		order by matched_path."pathId",
			matched_path."usageCount" desc,
			case matched_path.direction when 'forward' then 1 else 0 end desc,
			matched_path."matchedPartCount" desc,
			matched_path."decompositionIndex"
	`);
	const ranked = matched.rows
		.toSorted(
			(left, right) =>
				(right.usageCount > left.usageCount ? 1 : right.usageCount < left.usageCount ? -1 : 0) ||
				(right.direction === "forward" ? 1 : 0) - (left.direction === "forward" ? 1 : 0) ||
				right.matchedPartCount - left.matchedPartCount ||
				left.pathId.localeCompare(right.pathId),
		)
		.slice(0, input.limit);
	const members = await listPathMembers(
		ranked.map(({ pathId }) => pathId),
		input.localizationLanguages,
	);
	return ranked.flatMap((row) => {
		const pathMembers = members.get(row.pathId) ?? [];
		const terminal = pathMembers.at(-1);
		if (!terminal) return [];
		return [
			{
				tagId: terminal.tagId,
				language: terminal.language,
				title: terminal.title,
				summary: terminal.summary,
				avatar: terminal.avatar,
				pathId: row.pathId,
				members: pathMembers,
				matchDirection: row.direction,
				usageCount: toSafeInteger(row.usageCount, "Tag Path usage count"),
				score: toSafeInteger(row.score, "Tag Path score"),
				voteCount: toSafeInteger(row.voteCount, "Tag Path vote count"),
			},
		];
	});
}

/**
 * Resolves ordinary Tag input to either a direct Tag or its accepted ending
 * Path senses without creating a persisted primary selection.
 *
 * @remarks
 * A terminal Tag with one accepted Path produces one Path choice; several
 * accepted Paths produce a usage-weighted sense list; no accepted Path
 * produces a direct choice only when the Tag is directly applicable.
 *
 * @todo Replace the provisional accepted-usage-count ordering with the
 * separately adopted final ranking formula.
 */
export async function suggestTags(input: {
	readonly query: string;
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly limit: number;
}) {
	const compound = await suggestTagsFromCompoundPath(input);
	if (compound.length) return compound.map((item) => ({ ...item, selection: "path" as const }));

	const candidates = await database.execute<{
		readonly tagId: string;
		readonly updatedAtMicros: bigint;
	}>(sql`
		select candidate.unit_id as "tagId",
			candidate.unit_updated_at_micros as "updatedAtMicros"
		from public.search_text_candidates(
			array[${input.query}]::text[],
			${input.localizationLanguages ?? []}::text[],
			'tag',
			null,
			null,
			${TagCompoundPostingBudget},
			${Math.min(input.limit * 2, 40)}
		) candidate
		where candidate.search_matched
		order by candidate.unit_updated_at_micros desc, candidate.unit_id desc
	`);
	const candidateIds = candidates.rows.map(({ tagId }) => tagId);
	if (!candidateIds.length) return [];
	const directRows = await database
		.select({
			tagId: tag.id,
			directlyApplicable: tag.directlyApplicable,
			language: resolvedUnitLocalizationLanguage(tag.id, input.localizationLanguages),
			title: resolvedUnitLocalizationTitle(tag.id, input.localizationLanguages),
			summary: resolvedUnitLocalizationSummary(tag.id, input.localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(tag.id, input.localizationLanguages),
		})
		.from(tag)
		.innerJoin(unit, eq(unit.id, tag.id))
		.where(
			and(
				inArray(tag.id, candidateIds),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		);
	const directById = new Map(directRows.map((row) => [row.tagId, row] as const));
	const rankedPaths = await database.execute<{
		readonly pathId: string;
		readonly terminalTagId: string;
		readonly usageCount: bigint;
		readonly score: bigint;
		readonly voteCount: bigint;
	}>(sql`
		select ranked.path_id as "pathId",
			ranked.terminal_tag_id as "terminalTagId",
			ranked.usage_count as "usageCount",
			ranked.score,
			ranked.vote_count as "voteCount"
		from (
			select path.id as path_id,
				path.terminal_tag_id,
				stat.usage_count,
				stat.score,
				stat.vote_count,
				row_number() over (
					partition by path.terminal_tag_id
					order by stat.usage_count desc, path.id
				) as sense_rank
			from ${tagPath} path
			join ${tagPathVoteStat} stat on stat.path_id = path.id
			join ${unit} path_unit on path_unit.id = path.id
			where path.terminal_tag_id = any(${candidateIds}::uuid[])
				and stat.score > 0
				and stat.vote_count > 0
				and path_unit.status = 'published'
				and path_unit.visibility = 'public'
				and path_unit.moderation_status = 'approved'
				and path_unit.deleted_at is null
				and not exists (
					select 1 from ${tagPathMerge} merge
					where merge.source_path_id = path.id and merge.status = 'accepted'
				)
		) ranked
		where ranked.sense_rank <= 5
		order by ranked.usage_count desc, ranked.path_id
	`);
	const members = await listPathMembers(
		rankedPaths.rows.map(({ pathId }) => pathId),
		input.localizationLanguages,
	);
	const pathsByTerminal = new Map<string, typeof rankedPaths.rows>();
	for (const path of rankedPaths.rows) {
		const paths = pathsByTerminal.get(path.terminalTagId) ?? [];
		paths.push(path);
		pathsByTerminal.set(path.terminalTagId, paths);
	}
	return candidateIds
		.flatMap((tagId) => {
			const terminal = directById.get(tagId);
			if (!terminal) return [];
			const paths = pathsByTerminal.get(tagId) ?? [];
			if (paths.length)
				return paths.map((path) => ({
					selection: "path" as const,
					tagId,
					language: terminal.language,
					title: terminal.title,
					summary: terminal.summary,
					avatar: presentAvatar(terminal.avatar),
					pathId: path.pathId,
					members: members.get(path.pathId) ?? [],
					matchDirection: "forward" as const,
					usageCount: toSafeInteger(path.usageCount, "Tag Path usage count"),
					score: toSafeInteger(path.score, "Tag Path score"),
					voteCount: toSafeInteger(path.voteCount, "Tag Path vote count"),
				}));
			return terminal.directlyApplicable
				? [
						{
							selection: "direct" as const,
							tagId,
							language: terminal.language,
							title: terminal.title,
							summary: terminal.summary,
							avatar: presentAvatar(terminal.avatar),
							pathId: null,
							members: [],
							matchDirection: null,
							usageCount: 0,
							score: 0,
							voteCount: 0,
						},
					]
				: [];
		})
		.slice(0, input.limit);
}

export async function searchTagPathsForCuration(input: Parameters<typeof suggestTags>[0]) {
	const suggestions = await suggestTags(input);
	return suggestions.filter(
		(item): item is Extract<(typeof suggestions)[number], { selection: "path" }> =>
			item.selection === "path",
	);
}

async function ensurePathApplication(
	tx: DatabaseTransaction,
	unitId: string,
	pathId: string,
): Promise<void> {
	const [application] = await tx
		.select({ pathId: unitTagPath.pathId })
		.from(unitTagPath)
		.where(and(eq(unitTagPath.unitId, unitId), eq(unitTagPath.pathId, pathId)))
		.limit(1);
	if (!application) throw new TagPathApplicationNotFound();
}

async function upsertApplicationJudgment(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly pathId: string;
		readonly profileId: string;
		readonly fitVote?: BinaryVote;
		readonly spoilerLevel?: SpoilerLevel;
	},
) {
	if (input.fitVote === undefined && input.spoilerLevel === undefined) throw new InvalidTagPath();
	const now = new Date();
	await tx
		.insert(unitTagPathJudgment)
		.values({
			unitId: input.unitId,
			pathId: input.pathId,
			profileId: input.profileId,
			...(input.fitVote === undefined ? {} : { fitVote: input.fitVote, fitUpdatedAt: now }),
			...(input.spoilerLevel === undefined
				? {}
				: { spoilerLevel: input.spoilerLevel, spoilerUpdatedAt: now }),
		})
		.onConflictDoUpdate({
			target: [
				unitTagPathJudgment.unitId,
				unitTagPathJudgment.pathId,
				unitTagPathJudgment.profileId,
			],
			set: {
				...(input.fitVote === undefined ? {} : { fitVote: input.fitVote, fitUpdatedAt: now }),
				...(input.spoilerLevel === undefined
					? {}
					: { spoilerLevel: input.spoilerLevel, spoilerUpdatedAt: now }),
				updatedAt: now,
			},
		});
}

export async function applyTagPath(input: {
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	return runVoteTransaction({ family: "tag_path_application", authority: "global" }, async (tx) => {
		const [path] = await tx
			.select({
				id: tagPath.id,
				memberTagIds: tagPath.memberTagIds,
			})
			.from(tagPath)
			.where(
				and(
					eq(tagPath.id, input.pathId),
					sql`not exists (
							select 1 from ${tagPathMerge} merge
							where merge.source_path_id = ${tagPath.id} and merge.status = 'accepted'
						)`,
				),
			)
			.limit(1);
		if (!path) throw new TagPathNotFound();
		if (path.memberTagIds.includes(input.unitId)) throw new InvalidTagPath();
		await tx
			.insert(unitTagPath)
			.values({
				unitId: input.unitId,
				pathId: input.pathId,
				createdByProfileId: input.profileId,
			})
			.onConflictDoNothing();
		await upsertApplicationJudgment(tx, { ...input, fitVote: 1 });
		return getApplicationVoteSummary(tx, {
			unitId: input.unitId,
			pathId: input.pathId,
			viewerFitVote: 1,
			viewerSpoilerLevel: null,
		});
	});
}

export async function removeTagPathApplication(input: {
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
}): Promise<void> {
	await runVoteTransaction({ family: "tag_path_application", authority: "global" }, async (tx) => {
		const deleted = await tx
			.delete(unitTagPath)
			.where(and(eq(unitTagPath.unitId, input.unitId), eq(unitTagPath.pathId, input.pathId)))
			.returning({ id: unitTagPath.pathId });
		if (!deleted.length) throw new TagPathApplicationNotFound();
	});
}

async function getApplicationVoteSummary(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly pathId: string;
		readonly viewerFitVote: OptionalBinaryVote;
		readonly viewerSpoilerLevel: SpoilerLevel | null;
	},
) {
	const [row] = await tx
		.select({
			score: unitTagPathJudgmentStat.score,
			voteCount: unitTagPathJudgmentStat.voteCount,
			spoilerVoteCount: unitTagPathJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: unitTagPathJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: unitTagPathJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: unitTagPathJudgmentStat.spoilerMajorCount,
		})
		.from(unitTagPath)
		.leftJoin(
			unitTagPathJudgmentStat,
			and(
				eq(unitTagPathJudgmentStat.unitId, unitTagPath.unitId),
				eq(unitTagPathJudgmentStat.pathId, unitTagPath.pathId),
			),
		)
		.where(and(eq(unitTagPath.unitId, input.unitId), eq(unitTagPath.pathId, input.pathId)))
		.limit(1);
	if (!row) throw new TagPathApplicationNotFound();
	return {
		unitId: input.unitId,
		pathId: input.pathId,
		score: toSafeInteger(row.score ?? 0n, "Tag path application score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Tag path application vote count"),
		viewerVote: input.viewerFitVote,
		spoilerVoteCount: toSafeInteger(
			row.spoilerVoteCount ?? 0n,
			"Tag path application spoiler vote count",
		),
		spoilerDistribution: {
			none: toSafeInteger(row.spoilerNoneCount ?? 0n, "Tag path spoiler none count"),
			minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "Tag path spoiler minor count"),
			major: toSafeInteger(row.spoilerMajorCount ?? 0n, "Tag path spoiler major count"),
		},
		viewerSpoilerLevel: input.viewerSpoilerLevel,
	};
}

export async function judgeTagPathApplication(input: {
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
	readonly fitVote?: BinaryVote;
	readonly spoilerLevel?: SpoilerLevel;
}) {
	return runVoteTransaction({ family: "tag_path_application", authority: "global" }, async (tx) => {
		await ensurePathApplication(tx, input.unitId, input.pathId);
		await upsertApplicationJudgment(tx, input);
		return getApplicationVoteSummary(tx, {
			...input,
			viewerFitVote: input.fitVote ?? null,
			viewerSpoilerLevel: input.spoilerLevel ?? null,
		});
	});
}

export async function clearTagPathApplicationJudgment(input: {
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	return runVoteTransaction({ family: "tag_path_application", authority: "global" }, async (tx) => {
		await ensurePathApplication(tx, input.unitId, input.pathId);
		await tx
			.delete(unitTagPathJudgment)
			.where(
				and(
					eq(unitTagPathJudgment.unitId, input.unitId),
					eq(unitTagPathJudgment.pathId, input.pathId),
					eq(unitTagPathJudgment.profileId, input.profileId),
				),
			);
		return getApplicationVoteSummary(tx, {
			...input,
			viewerFitVote: null,
			viewerSpoilerLevel: null,
		});
	});
}

export async function listVisibleUnitTagPaths(input: {
	readonly unitId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const rows = await database
		.select({
			pathId: unitTagPath.pathId,
			pinned: unitTagPath.pinned,
			position: unitTagPath.position,
			score: unitTagPathJudgmentStat.score,
			voteCount: unitTagPathJudgmentStat.voteCount,
			viewerVote: viewerApplicationVote.fitVote,
			viewerSpoilerLevel: viewerApplicationVote.spoilerLevel,
			spoilerVoteCount: unitTagPathJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: unitTagPathJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: unitTagPathJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: unitTagPathJudgmentStat.spoilerMajorCount,
			definitionScore: tagPathVoteStat.score,
			definitionVoteCount: tagPathVoteStat.voteCount,
			usageCount: tagPathVoteStat.usageCount,
			createdAt: unitTagPath.createdAt,
			updatedAt: unitTagPath.updatedAt,
			totalCount: sql<bigint>`count(*) over()`,
		})
		.from(unitTagPath)
		.innerJoin(tagPath, eq(tagPath.id, unitTagPath.pathId))
		.innerJoin(unit, eq(unit.id, tagPath.id))
		.innerJoin(
			unitTagPathJudgmentStat,
			and(
				eq(unitTagPathJudgmentStat.unitId, unitTagPath.unitId),
				eq(unitTagPathJudgmentStat.pathId, unitTagPath.pathId),
			),
		)
		.innerJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.leftJoin(
			viewerApplicationVote,
			and(
				eq(viewerApplicationVote.unitId, unitTagPath.unitId),
				eq(viewerApplicationVote.pathId, unitTagPath.pathId),
				input.viewerProfileId
					? eq(viewerApplicationVote.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(
			and(
				eq(unitTagPath.unitId, input.unitId),
				sql`${unitTagPathJudgmentStat.score} > 0`,
				gt(unitTagPathJudgmentStat.voteCount, 0n),
				sql`${tagPathVoteStat.score} > 0`,
				gt(tagPathVoteStat.voteCount, 0n),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				sql`not exists (
					select 1 from ${tagPathMerge} merge
					where merge.source_path_id = ${tagPath.id} and merge.status = 'accepted'
				)`,
				sql`not exists (
					select 1
					from ${tagPathMember} member
					join unit member_unit on member_unit.id = member.tag_id
					where member.path_id = ${tagPath.id}
						and (
							member_unit.kind <> 'tag'
							or member_unit.status <> 'published'
							or member_unit.visibility <> 'public'
							or member_unit.moderation_status <> 'approved'
							or member_unit.deleted_at is not null
						)
				)`,
			),
		)
		.orderBy(
			desc(unitTagPath.pinned),
			sql`case when ${unitTagPath.pinned} then ${unitTagPath.position} end asc nulls last`,
			desc(applicationWilsonConfidence),
			desc(unitTagPathJudgmentStat.score),
			desc(unitTagPathJudgmentStat.voteCount),
			unitTagPath.pathId,
		)
		.limit(input.limit);
	const members = await listPathMembers(
		rows.map(({ pathId }) => pathId),
		input.localizationLanguages,
	);
	return {
		totalCount: toSafeInteger(rows[0]?.totalCount ?? 0n, "Unit Tag Path total count"),
		items: rows.map(({ totalCount: _totalCount, ...row }) => ({
			...row,
			score: toSafeInteger(row.score, "Tag path application score"),
			voteCount: toSafeInteger(row.voteCount, "Tag path application vote count"),
			viewerVote: presentVote(row.viewerVote),
			viewerSpoilerLevel: presentSpoilerLevel(row.viewerSpoilerLevel),
			spoilerVoteCount: toSafeInteger(row.spoilerVoteCount ?? 0n, "Tag path spoiler vote count"),
			spoilerDistribution: {
				none: toSafeInteger(row.spoilerNoneCount ?? 0n, "Tag path spoiler none count"),
				minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "Tag path spoiler minor count"),
				major: toSafeInteger(row.spoilerMajorCount ?? 0n, "Tag path spoiler major count"),
			},
			definitionScore: toSafeInteger(row.definitionScore ?? 0n, "Tag path score"),
			definitionVoteCount: toSafeInteger(row.definitionVoteCount ?? 0n, "Tag path vote count"),
			usageCount: toSafeInteger(row.usageCount ?? 0n, "Tag path usage count"),
			members: members.get(row.pathId) ?? [],
		})),
	};
}

type HierarchyEdge = {
	readonly parentTagId: string;
	readonly childTagId: string;
	readonly score: number;
	readonly voteCount: number;
};

async function listRankedHierarchyEdges(parentTagIds: readonly string[]): Promise<HierarchyEdge[]> {
	if (parentTagIds.length === 0) return [];
	const rows = await database
		.select({
			parentTagId: tagPathEdge.parentTagId,
			childTagId: tagPathEdge.childTagId,
			score: tagPathVoteStat.score,
			voteCount: tagPathVoteStat.voteCount,
		})
		.from(tagPathEdge)
		.innerJoin(hierarchyChildUnit, eq(hierarchyChildUnit.id, tagPathEdge.childTagId))
		.innerJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPathEdge.pathId))
		.where(
			and(
				inArray(tagPathEdge.parentTagId, [...parentTagIds]),
				sql`${tagPathVoteStat.score} > 0`,
				gt(tagPathVoteStat.voteCount, 0n),
				eq(hierarchyChildUnit.kind, "tag"),
				eq(hierarchyChildUnit.status, "published"),
				eq(hierarchyChildUnit.visibility, "public"),
				eq(hierarchyChildUnit.moderationStatus, "approved"),
				isNull(hierarchyChildUnit.deletedAt),
			),
		);
	const best = new Map<string, HierarchyEdge>();
	for (const row of rows) {
		const edge = {
			parentTagId: row.parentTagId,
			childTagId: row.childTagId,
			score: toSafeInteger(row.score, "Tag path score"),
			voteCount: toSafeInteger(row.voteCount, "Tag path vote count"),
		};
		const key = `${edge.parentTagId}\u0000${edge.childTagId}`;
		const previous = best.get(key);
		if (
			!previous ||
			edge.score > previous.score ||
			(edge.score === previous.score && edge.voteCount > previous.voteCount)
		)
			best.set(key, edge);
	}
	return [...best.values()].toSorted(
		(left, right) =>
			wilsonLowerBound(right.score, right.voteCount) -
				wilsonLowerBound(left.score, left.voteCount) ||
			right.score - left.score ||
			right.voteCount - left.voteCount ||
			left.childTagId.localeCompare(right.childTagId),
	);
}

async function hydrateHierarchyTags(
	tagIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
) {
	if (tagIds.length === 0)
		return new Map<
			string,
			{ language: ContentLanguage | null; title: string | null; summary: string | null }
		>();
	const rows = await database
		.select({
			tagId: unit.id,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(unit.id, localizationLanguages),
		})
		.from(unit)
		.where(inArray(unit.id, [...new Set(tagIds)]));
	return new Map(
		rows.map((row) => [
			row.tagId,
			{ language: row.language, title: row.title, summary: row.summary },
		]),
	);
}

export async function getTagHierarchy(input: {
	readonly tagId: string;
	readonly authorization: TagHierarchyAuthorization;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly childLimit: number;
	readonly grandchildLimit: number;
}) {
	await input.authorization.ensureCanRead(input.tagId, () => new TagNotFound());
	const [tagRecord] = await database
		.select({ id: tag.id })
		.from(tag)
		.where(eq(tag.id, input.tagId))
		.limit(1);
	if (!tagRecord) throw new TagNotFound();
	const directEdges = await listRankedHierarchyEdges([input.tagId]);
	const selectedDirect = directEdges.slice(0, input.childLimit);
	const grandchildEdges = await listRankedHierarchyEdges(
		selectedDirect.map(({ childTagId }) => childTagId),
	);
	const byParent = new Map<string, HierarchyEdge[]>();
	for (const edge of grandchildEdges) {
		const items = byParent.get(edge.parentTagId) ?? [];
		if (items.length < input.grandchildLimit) items.push(edge);
		byParent.set(edge.parentTagId, items);
	}
	const allIds = [
		input.tagId,
		...selectedDirect.map(({ childTagId }) => childTagId),
		...selectedDirect.flatMap(({ childTagId }) =>
			(byParent.get(childTagId) ?? []).map((edge) => edge.childTagId),
		),
	];
	const localized = await hydrateHierarchyTags(allIds, input.localizationLanguages);
	const localization = (tagId: string) =>
		localized.get(tagId) ?? { language: null, title: null, summary: null };
	return {
		tagId: input.tagId,
		...localization(input.tagId),
		children: selectedDirect.map((edge) => ({
			tagId: edge.childTagId,
			...localization(edge.childTagId),
			score: edge.score,
			voteCount: edge.voteCount,
			children: (byParent.get(edge.childTagId) ?? []).map((grandchild) => ({
				tagId: grandchild.childTagId,
				...localization(grandchild.childTagId),
				score: grandchild.score,
				voteCount: grandchild.voteCount,
			})),
		})),
	};
}

type RealmTagFallbackPolicy = "inherit" | "isolate";
function presentSpoilerLevel(value: number | null): SpoilerLevel | null {
	if (value === null || value === 0 || value === 1 || value === 2) return value;
	throw new Error("Stored Tag Path spoiler level has an invalid value");
}

function presentRealmResolution(input: {
	readonly localCount: bigint;
	readonly globalCount: bigint;
	readonly policy: RealmTagFallbackPolicy;
	readonly dimension: "fit" | "spoiler";
}) {
	if (input.localCount > 0n)
		return {
			authority: "realm" as const,
			resolutionState: "decided" as const,
			provenance: {
				authority: "realm" as const,
				relation: "realm_unit_tag_path_judgment_stat" as const,
				dimension: input.dimension,
			},
		};
	if (input.policy === "inherit" && input.globalCount > 0n)
		return {
			authority: "global" as const,
			resolutionState: "inherited" as const,
			provenance: {
				authority: "global" as const,
				relation: "unit_tag_path_judgment_stat" as const,
				dimension: input.dimension,
			},
		};
	return {
		authority: "realm" as const,
		resolutionState: "unresolved" as const,
		provenance: {
			authority: "realm" as const,
			relation: "realm_unit_tag_path_judgment_stat" as const,
			dimension: input.dimension,
		},
	};
}

export async function listRealmTagPaths(input: {
	readonly realmId: string;
	readonly unitId?: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const [realmPolicy] = await database
		.select({
			fit: realm.tagFitFallbackPolicy,
			spoiler: realm.tagSpoilerFallbackPolicy,
		})
		.from(realm)
		.where(eq(realm.id, input.realmId))
		.limit(1);
	if (!realmPolicy) throw new RealmNotFound();
	const definitions = await database
		.select({
			pathId: realmTagPath.pathId,
			score: realmTagPathVoteStat.score,
			voteCount: realmTagPathVoteStat.voteCount,
			usageCount: realmTagPathVoteStat.usageCount,
			viewerVote: viewerRealmDefinitionVote.value,
			createdAt: realmTagPath.createdAt,
		})
		.from(realmTagPath)
		.innerJoin(
			realmTagPathVoteStat,
			and(
				eq(realmTagPathVoteStat.realmId, realmTagPath.realmId),
				eq(realmTagPathVoteStat.pathId, realmTagPath.pathId),
			),
		)
		.leftJoin(
			viewerRealmDefinitionVote,
			and(
				eq(viewerRealmDefinitionVote.realmId, realmTagPath.realmId),
				eq(viewerRealmDefinitionVote.pathId, realmTagPath.pathId),
				input.viewerProfileId
					? eq(viewerRealmDefinitionVote.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(
			and(
				eq(realmTagPath.realmId, input.realmId),
				gt(realmTagPathVoteStat.score, 0n),
				gt(realmTagPathVoteStat.voteCount, 0n),
			),
		)
		.orderBy(desc(realmTagPathVoteStat.usageCount), realmTagPath.pathId)
		.limit(input.limit);
	const pathIds = definitions.map(({ pathId }) => pathId);
	const members = await listPathMembers(pathIds, input.localizationLanguages);
	const applications =
		input.unitId && pathIds.length
			? await database
					.select({
						pathId: realmUnitTagPath.pathId,
						localScore: realmUnitTagPathJudgmentStat.score,
						localVoteCount: realmUnitTagPathJudgmentStat.voteCount,
						localSpoilerVoteCount: realmUnitTagPathJudgmentStat.spoilerVoteCount,
						localSpoilerNoneCount: realmUnitTagPathJudgmentStat.spoilerNoneCount,
						localSpoilerMinorCount: realmUnitTagPathJudgmentStat.spoilerMinorCount,
						localSpoilerMajorCount: realmUnitTagPathJudgmentStat.spoilerMajorCount,
						globalScore: unitTagPathJudgmentStat.score,
						globalVoteCount: unitTagPathJudgmentStat.voteCount,
						globalSpoilerVoteCount: unitTagPathJudgmentStat.spoilerVoteCount,
						globalSpoilerNoneCount: unitTagPathJudgmentStat.spoilerNoneCount,
						globalSpoilerMinorCount: unitTagPathJudgmentStat.spoilerMinorCount,
						globalSpoilerMajorCount: unitTagPathJudgmentStat.spoilerMajorCount,
						viewerFitVote: viewerRealmApplicationJudgment.fitVote,
						viewerSpoilerLevel: viewerRealmApplicationJudgment.spoilerLevel,
					})
					.from(realmUnitTagPath)
					.leftJoin(
						realmUnitTagPathJudgmentStat,
						and(
							eq(realmUnitTagPathJudgmentStat.realmId, realmUnitTagPath.realmId),
							eq(realmUnitTagPathJudgmentStat.unitId, realmUnitTagPath.unitId),
							eq(realmUnitTagPathJudgmentStat.pathId, realmUnitTagPath.pathId),
						),
					)
					.leftJoin(
						unitTagPathJudgmentStat,
						and(
							eq(unitTagPathJudgmentStat.unitId, realmUnitTagPath.unitId),
							eq(unitTagPathJudgmentStat.pathId, realmUnitTagPath.pathId),
						),
					)
					.leftJoin(
						viewerRealmApplicationJudgment,
						and(
							eq(viewerRealmApplicationJudgment.realmId, realmUnitTagPath.realmId),
							eq(viewerRealmApplicationJudgment.unitId, realmUnitTagPath.unitId),
							eq(viewerRealmApplicationJudgment.pathId, realmUnitTagPath.pathId),
							input.viewerProfileId
								? eq(viewerRealmApplicationJudgment.profileId, input.viewerProfileId)
								: sql`false`,
						),
					)
					.where(
						and(
							eq(realmUnitTagPath.realmId, input.realmId),
							eq(realmUnitTagPath.unitId, input.unitId),
							inArray(realmUnitTagPath.pathId, pathIds),
						),
					)
			: [];
	const applicationByPath = new Map(applications.map((item) => [item.pathId, item]));
	const distribution = (none: bigint | null, minor: bigint | null, major: bigint | null) => ({
		none: toSafeInteger(none ?? 0n, "Tag Path spoiler none count"),
		minor: toSafeInteger(minor ?? 0n, "Tag Path spoiler minor count"),
		major: toSafeInteger(major ?? 0n, "Tag Path spoiler major count"),
	});
	return {
		realmId: input.realmId,
		policy: {
			fitFallback: realmPolicy.fit,
			spoilerFallback: realmPolicy.spoiler,
		},
		items: definitions.map((definition) => {
			const application = applicationByPath.get(definition.pathId);
			const localFitCount = application?.localVoteCount ?? 0n;
			const globalFitCount = application?.globalVoteCount ?? 0n;
			const localSpoilerCount = application?.localSpoilerVoteCount ?? 0n;
			const globalSpoilerCount = application?.globalSpoilerVoteCount ?? 0n;
			const fitResolution = presentRealmResolution({
				localCount: localFitCount,
				globalCount: globalFitCount,
				policy: realmPolicy.fit,
				dimension: "fit",
			});
			const spoilerResolution = presentRealmResolution({
				localCount: localSpoilerCount,
				globalCount: globalSpoilerCount,
				policy: realmPolicy.spoiler,
				dimension: "spoiler",
			});
			const useGlobalFit = fitResolution.authority === "global";
			const useGlobalSpoiler = spoilerResolution.authority === "global";
			return {
				pathId: definition.pathId,
				members: members.get(definition.pathId) ?? [],
				definition: {
					authority: "realm" as const,
					score: toSafeInteger(definition.score, "Realm Tag Path score"),
					voteCount: toSafeInteger(definition.voteCount, "Realm Tag Path vote count"),
					usageCount: toSafeInteger(definition.usageCount, "Realm Tag Path usage count"),
					viewerVote: presentVote(definition.viewerVote),
					provenance: {
						authority: "realm" as const,
						relation: "realm_tag_path_vote_stat" as const,
					},
				},
				application: !application
					? null
					: {
							fit: {
								...fitResolution,
								score: toSafeInteger(
									(useGlobalFit ? application.globalScore : application.localScore) ?? 0n,
									"Realm resolved Tag Path fit score",
								),
								voteCount: toSafeInteger(
									(useGlobalFit ? application.globalVoteCount : application.localVoteCount) ?? 0n,
									"Realm resolved Tag Path fit vote count",
								),
								viewerVote: presentVote(application.viewerFitVote),
							},
							spoiler: {
								...spoilerResolution,
								voteCount: toSafeInteger(
									(useGlobalSpoiler
										? application.globalSpoilerVoteCount
										: application.localSpoilerVoteCount) ?? 0n,
									"Realm resolved Tag Path spoiler vote count",
								),
								distribution: useGlobalSpoiler
									? distribution(
											application.globalSpoilerNoneCount,
											application.globalSpoilerMinorCount,
											application.globalSpoilerMajorCount,
										)
									: distribution(
											application.localSpoilerNoneCount,
											application.localSpoilerMinorCount,
											application.localSpoilerMajorCount,
										),
								viewerLevel: presentSpoilerLevel(application.viewerSpoilerLevel),
							},
						},
				createdAt: definition.createdAt,
			};
		}),
	};
}

async function ensureAcceptedTagPath(tx: DatabaseTransaction, pathId: string): Promise<void> {
	const [accepted] = await tx
		.select({ id: tagPath.id })
		.from(tagPath)
		.innerJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.where(
			and(
				eq(tagPath.id, pathId),
				gt(tagPathVoteStat.score, 0n),
				gt(tagPathVoteStat.voteCount, 0n),
				sql`not exists (
					select 1 from ${tagPathMerge} merge
					where merge.source_path_id = ${tagPath.id} and merge.status = 'accepted'
				)`,
			),
		)
		.limit(1);
	if (!accepted) throw new TagPathNotFound();
}

export async function adoptRealmTagPath(input: {
	readonly realmId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	return runVoteTransaction({ family: "tag_path", authority: "realm" }, async (tx) => {
		await ensureAcceptedTagPath(tx, input.pathId);
		await tx
			.insert(realmTagPath)
			.values({
				realmId: input.realmId,
				pathId: input.pathId,
				createdByProfileId: input.profileId,
			})
			.onConflictDoNothing();
		await tx
			.insert(realmTagPathVote)
			.values({ ...input, value: 1 })
			.onConflictDoUpdate({
				target: [realmTagPathVote.realmId, realmTagPathVote.pathId, realmTagPathVote.profileId],
				set: { value: 1, updatedAt: new Date() },
			});
		return { realmId: input.realmId, pathId: input.pathId, viewerVote: 1 as const };
	});
}

export async function voteRealmTagPath(input: {
	readonly realmId: string;
	readonly pathId: string;
	readonly profileId: string;
	readonly value: BinaryVote;
}) {
	await runVoteTransaction({ family: "tag_path", authority: "realm" }, async (tx) => {
		await tx
			.insert(realmTagPathVote)
			.values(input)
			.onConflictDoUpdate({
				target: [realmTagPathVote.realmId, realmTagPathVote.pathId, realmTagPathVote.profileId],
				set: { value: input.value, updatedAt: new Date() },
			});
	});
	return { realmId: input.realmId, pathId: input.pathId, viewerVote: input.value };
}

export async function deleteRealmTagPathVote(input: {
	readonly realmId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	return runVoteTransaction({ family: "tag_path", authority: "realm" }, async (tx) => {
		const deleted = await tx
			.delete(realmTagPathVote)
			.where(
				and(
					eq(realmTagPathVote.realmId, input.realmId),
					eq(realmTagPathVote.pathId, input.pathId),
					eq(realmTagPathVote.profileId, input.profileId),
				),
			)
			.returning({ pathId: realmTagPathVote.pathId });
		if (!deleted.length) throw new TagPathNotFound();
		return { realmId: input.realmId, pathId: input.pathId };
	});
}

export async function applyRealmTagPath(input: {
	readonly realmId: string;
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	return runVoteTransaction({ family: "tag_path_application", authority: "realm" }, async (tx) => {
		const [mounted] = await tx
			.select({ unitId: realmUnit.unitId })
			.from(realmUnit)
			.where(and(eq(realmUnit.realmId, input.realmId), eq(realmUnit.unitId, input.unitId)))
			.limit(1);
		if (!mounted) throw new TagPathApplicationNotFound();
		await tx.insert(realmUnitTagPath).values(input).onConflictDoNothing();
		const now = new Date();
		await tx
			.insert(realmUnitTagPathJudgment)
			.values({ ...input, fitVote: 1, fitUpdatedAt: now })
			.onConflictDoUpdate({
				target: [
					realmUnitTagPathJudgment.realmId,
					realmUnitTagPathJudgment.unitId,
					realmUnitTagPathJudgment.pathId,
					realmUnitTagPathJudgment.profileId,
				],
				set: { fitVote: 1, fitUpdatedAt: now, updatedAt: now },
			});
		return { realmId: input.realmId, unitId: input.unitId, pathId: input.pathId };
	});
}

export async function removeRealmTagPathApplication(input: {
	readonly realmId: string;
	readonly unitId: string;
	readonly pathId: string;
}): Promise<void> {
	await runVoteTransaction({ family: "tag_path_application", authority: "realm" }, async (tx) => {
		const deleted = await tx
			.delete(realmUnitTagPath)
			.where(
				and(
					eq(realmUnitTagPath.realmId, input.realmId),
					eq(realmUnitTagPath.unitId, input.unitId),
					eq(realmUnitTagPath.pathId, input.pathId),
				),
			)
			.returning({ pathId: realmUnitTagPath.pathId });
		if (!deleted.length) throw new TagPathApplicationNotFound();
	});
}

export async function judgeRealmTagPathApplication(input: {
	readonly realmId: string;
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
	readonly fitVote?: BinaryVote;
	readonly spoilerLevel?: SpoilerLevel;
}) {
	if (input.fitVote === undefined && input.spoilerLevel === undefined) throw new InvalidTagPath();
	const now = new Date();
	const values = {
		realmId: input.realmId,
		unitId: input.unitId,
		pathId: input.pathId,
		profileId: input.profileId,
		...(input.fitVote === undefined ? {} : { fitVote: input.fitVote, fitUpdatedAt: now }),
		...(input.spoilerLevel === undefined
			? {}
			: { spoilerLevel: input.spoilerLevel, spoilerUpdatedAt: now }),
	};
	await runVoteTransaction({ family: "tag_path_application", authority: "realm" }, async (tx) => {
		await tx
			.insert(realmUnitTagPathJudgment)
			.values(values)
			.onConflictDoUpdate({
				target: [
					realmUnitTagPathJudgment.realmId,
					realmUnitTagPathJudgment.unitId,
					realmUnitTagPathJudgment.pathId,
					realmUnitTagPathJudgment.profileId,
				],
				set: { ...values, updatedAt: now },
			});
	});
	return {
		realmId: input.realmId,
		unitId: input.unitId,
		pathId: input.pathId,
		viewerFitVote: input.fitVote ?? null,
		viewerSpoilerLevel: input.spoilerLevel ?? null,
	};
}

export async function clearRealmTagPathApplicationJudgment(input: {
	readonly realmId: string;
	readonly unitId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	await runVoteTransaction({ family: "tag_path_application", authority: "realm" }, async (tx) => {
		await tx
			.delete(realmUnitTagPathJudgment)
			.where(
				and(
					eq(realmUnitTagPathJudgment.realmId, input.realmId),
					eq(realmUnitTagPathJudgment.unitId, input.unitId),
					eq(realmUnitTagPathJudgment.pathId, input.pathId),
					eq(realmUnitTagPathJudgment.profileId, input.profileId),
				),
			);
	});
	return { realmId: input.realmId, unitId: input.unitId, pathId: input.pathId };
}

export async function updateRealmTagPathFallbackPolicy(input: {
	readonly realmId: string;
	readonly fitFallback: RealmTagFallbackPolicy;
	readonly spoilerFallback: RealmTagFallbackPolicy;
}) {
	const [updated] = await database
		.update(realm)
		.set({
			tagFitFallbackPolicy: input.fitFallback,
			tagSpoilerFallbackPolicy: input.spoilerFallback,
			updatedAt: new Date(),
		})
		.where(eq(realm.id, input.realmId))
		.returning({ realmId: realm.id });
	if (!updated) throw new RealmNotFound();
	return { ...updated, fitFallback: input.fitFallback, spoilerFallback: input.spoilerFallback };
}
