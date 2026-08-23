import { and, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";
import { createCommunityOwnedUnitAccess } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { databaseConstraintName } from "../database/constraint";
import { runVndbVoteTransaction } from "../database/vndb-vote-admission";
import { toSafeInteger } from "../database/integer";
import {
	currentUnitStructureEdge,
	currentUnitStructureMember,
	tag,
	unit,
	unitStructure,
	unitStructureApplication,
	unitStructureApplicationJudgment,
	unitStructureApplicationJudgmentStat,
	unitStructureVote,
	unitStructureVoteStat,
	UnitStructureMaximumMembers,
	UnitStructureMinimumMembers,
} from "../database/schema";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import type { RevisionContributionInput } from "../units/revision-contribution";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";
import { presentAvatar } from "../units/avatar";
import {
	InvalidTagStructure,
	TagNotFound,
	TagStructureApplicationNotFound,
	TagStructureDefinitionConflict,
	TagStructureNotFound,
} from "../api/tags/errors";
import { wilsonLowerBound, wilsonLowerBoundSql } from "../tags/ranking";

export type BinaryVote = -1 | 1;
export type OptionalBinaryVote = BinaryVote | null;

type TagHierarchyAuthorization = {
	readonly ensureCanRead: (unitId: string, onDenied: () => TagNotFound) => Promise<void>;
};

export function toTagStructureConstraintError(error: unknown): InvalidTagStructure | undefined {
	const constraint = databaseConstraintName(error);
	if (
		constraint?.startsWith("unit_structure_") ||
		constraint === "unit_effective_tag_not_self_check"
	)
		return new InvalidTagStructure();
	const visited = new Set<unknown>();
	let current = error;
	while (current && typeof current === "object" && !visited.has(current)) {
		visited.add(current);
		const code = Reflect.get(current, "code");
		const message = Reflect.get(current, "message");
		if (
			(code === "23514" || code === "55000") &&
			typeof message === "string" &&
			/structure|Tag hierarchy path/i.test(message)
		)
			return new InvalidTagStructure();
		current = Reflect.get(current, "cause");
	}
	return undefined;
}

const memberUnit = alias(unit, "tag_structure_member_unit");
const hierarchyChildUnit = alias(unit, "tag_hierarchy_child_unit");
const viewerDefinitionVote = alias(unitStructureVote, "viewer_tag_structure_vote");
const viewerApplicationVote = alias(
	unitStructureApplicationJudgment,
	"viewer_tag_structure_application_vote",
);
const applicationWilsonConfidence = wilsonLowerBoundSql(
	unitStructureApplicationJudgmentStat.score,
	unitStructureApplicationJudgmentStat.voteCount,
);

function presentVote(value: number | null): OptionalBinaryVote {
	if (value === null || value === -1 || value === 1) return value;
	throw new Error("Stored Tag structure vote has an invalid value");
}

function structurePathKey(memberTagIds: readonly string[]): string {
	return JSON.stringify(["tag.hierarchy_path", ...memberTagIds]);
}

function validateMemberTagIds(memberTagIds: readonly string[]): void {
	if (
		memberTagIds.length < UnitStructureMinimumMembers ||
		memberTagIds.length > UnitStructureMaximumMembers ||
		new Set(memberTagIds).size !== memberTagIds.length
	)
		throw new InvalidTagStructure();
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
	structureId: string,
	profileId: string,
	value: BinaryVote,
	createdAt?: Date,
): Promise<void> {
	await tx
		.insert(unitStructureVote)
		.values({ structureId, profileId, value, createdAt, updatedAt: createdAt })
		.onConflictDoUpdate({
			target: [unitStructureVote.structureId, unitStructureVote.profileId],
			set: { value, updatedAt: new Date() },
		});
}

export interface CreateTagStructureInput {
	readonly structureId?: string;
	readonly memberTagIds: readonly string[];
	readonly profileId: string;
	readonly contribution?: RevisionContributionInput;
	readonly createdAt?: Date;
}

export async function createTagStructureInTransaction(
	tx: DatabaseTransaction,
	input: CreateTagStructureInput,
): Promise<{ readonly structureId: string; readonly created: boolean }> {
	validateMemberTagIds(input.memberTagIds);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${structurePathKey(input.memberTagIds)}, 0))`,
	);
	await ensureCreatableTags(tx, input.memberTagIds);
	if (input.structureId) {
		const [declaredIdentity] = await tx
			.select({
				id: unit.id,
				unitKind: unit.kind,
				structureKind: unitStructure.kind,
				definitionVersion: unitStructure.definitionVersion,
				memberUnitIds: unitStructure.memberUnitIds,
			})
			.from(unit)
			.leftJoin(unitStructure, eq(unitStructure.id, unit.id))
			.where(eq(unit.id, input.structureId))
			.limit(1);
		if (declaredIdentity) {
			if (
				declaredIdentity.unitKind !== "structure" ||
				declaredIdentity.structureKind !== "tag.hierarchy_path" ||
				declaredIdentity.definitionVersion !== 1 ||
				!declaredIdentity.memberUnitIds ||
				!sameOrderedIds(declaredIdentity.memberUnitIds, input.memberTagIds)
			)
				throw new TagStructureDefinitionConflict(input.structureId);
			await upsertDefinitionVote(tx, input.structureId, input.profileId, 1, input.createdAt);
			return { structureId: input.structureId, created: false };
		}
	}
	const [existing] = await tx
		.select({ id: unitStructure.id })
		.from(unitStructure)
		.where(
			and(
				eq(unitStructure.kind, "tag.hierarchy_path"),
				eq(unitStructure.definitionVersion, 1),
				eq(unitStructure.memberUnitIds, [...input.memberTagIds]),
			),
		)
		.limit(1);
	if (existing) {
		await upsertDefinitionVote(tx, existing.id, input.profileId, 1, input.createdAt);
		return { structureId: existing.id, created: false };
	}

	const createdAt = input.createdAt ?? new Date();
	const created = await insertUnit(tx, {
		id: input.structureId,
		kind: "structure",
		status: "published",
		visibility: "public",
		publishedAt: createdAt,
		createdAt,
		updatedAt: createdAt,
		statusActor: { kind: "profile", profileId: input.profileId },
	});
	await tx.insert(unitStructure).values({
		id: created.id,
		kind: "tag.hierarchy_path",
		memberUnitIds: [...input.memberTagIds],
		createdByProfileId: input.profileId,
		createdAt,
		updatedAt: createdAt,
	});
	await createCommunityOwnedUnitAccess(tx, created.id);
	await upsertDefinitionVote(tx, created.id, input.profileId, 1, createdAt);
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.profileId,
		contribution: input.contribution,
		event: "create",
	});
	return { structureId: created.id, created: true };
}

export async function createTagStructure(
	input: CreateTagStructureInput,
): Promise<{ readonly structureId: string; readonly created: boolean }> {
	return runVndbVoteTransaction({ family: "tag_structure", authority: "global" }, (tx) =>
		createTagStructureInTransaction(tx, input),
	);
}

async function getDefinitionVoteSummary(structureId: string, viewerVote: OptionalBinaryVote) {
	const [row] = await database
		.select({
			score: unitStructureVoteStat.score,
			voteCount: unitStructureVoteStat.voteCount,
		})
		.from(unitStructure)
		.leftJoin(unitStructureVoteStat, eq(unitStructureVoteStat.structureId, unitStructure.id))
		.where(eq(unitStructure.id, structureId))
		.limit(1);
	if (!row) throw new TagStructureNotFound();
	return {
		score: toSafeInteger(row.score ?? 0n, "Tag structure score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Tag structure vote count"),
		viewerVote,
	};
}

export async function voteTagStructure(input: {
	readonly structureId: string;
	readonly profileId: string;
	readonly value: BinaryVote;
}) {
	const updated = await runVndbVoteTransaction(
		{ family: "tag_structure", authority: "global" },
		async (tx) => {
			const [existing] = await tx
				.select({ id: unitStructure.id })
				.from(unitStructure)
				.where(eq(unitStructure.id, input.structureId))
				.limit(1);
			if (!existing) throw new TagStructureNotFound();
			await upsertDefinitionVote(tx, input.structureId, input.profileId, input.value);
			return input.value;
		},
	);
	return getDefinitionVoteSummary(input.structureId, updated);
}

export async function deleteTagStructureVote(input: {
	readonly structureId: string;
	readonly profileId: string;
}) {
	await runVndbVoteTransaction({ family: "tag_structure", authority: "global" }, async (tx) => {
		const [existing] = await tx
			.select({ id: unitStructure.id })
			.from(unitStructure)
			.where(eq(unitStructure.id, input.structureId))
			.limit(1);
		if (!existing) throw new TagStructureNotFound();
		await tx
			.delete(unitStructureVote)
			.where(
				and(
					eq(unitStructureVote.structureId, input.structureId),
					eq(unitStructureVote.profileId, input.profileId),
				),
			);
	});
	return getDefinitionVoteSummary(input.structureId, null);
}

async function listStructureMembers(
	structureIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
) {
	if (structureIds.length === 0) return new Map<string, TagStructureMember[]>();
	const rows = await database
		.select({
			structureId: currentUnitStructureMember.structureId,
			ordinal: currentUnitStructureMember.ordinal,
			tagId: currentUnitStructureMember.memberUnitId,
			language: resolvedUnitLocalizationLanguage(memberUnit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(memberUnit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(memberUnit.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(memberUnit.id, localizationLanguages),
		})
		.from(currentUnitStructureMember)
		.innerJoin(memberUnit, eq(memberUnit.id, currentUnitStructureMember.memberUnitId))
		.where(inArray(currentUnitStructureMember.structureId, [...structureIds]))
		.orderBy(currentUnitStructureMember.structureId, currentUnitStructureMember.ordinal);
	const grouped = new Map<string, TagStructureMember[]>();
	for (const row of rows) {
		const items = grouped.get(row.structureId) ?? [];
		items.push({
			ordinal: row.ordinal,
			tagId: row.tagId,
			language: row.language,
			title: row.title,
			summary: row.summary,
			avatar: presentAvatar(row.avatar),
		});
		grouped.set(row.structureId, items);
	}
	return grouped;
}

export type TagStructureMember = {
	readonly ordinal: number;
	readonly tagId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: ReturnType<typeof presentAvatar>;
};

export async function getTagStructure(input: {
	readonly structureId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
}) {
	const [record] = await database
		.select({
			id: unitStructure.id,
			kind: unitStructure.kind,
			definitionVersion: unitStructure.definitionVersion,
			createdByProfileId: unitStructure.createdByProfileId,
			score: unitStructureVoteStat.score,
			voteCount: unitStructureVoteStat.voteCount,
			viewerVote: viewerDefinitionVote.value,
			createdAt: unitStructure.createdAt,
			updatedAt: unitStructure.updatedAt,
		})
		.from(unitStructure)
		.innerJoin(unit, eq(unit.id, unitStructure.id))
		.leftJoin(unitStructureVoteStat, eq(unitStructureVoteStat.structureId, unitStructure.id))
		.leftJoin(
			viewerDefinitionVote,
			and(
				eq(viewerDefinitionVote.structureId, unitStructure.id),
				input.viewerProfileId
					? eq(viewerDefinitionVote.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(
			and(
				eq(unitStructure.id, input.structureId),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				sql`not exists (
					select 1
					from ${currentUnitStructureMember} member
					join unit member_unit on member_unit.id = member.member_unit_id
					where member.structure_id = ${unitStructure.id}
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
	if (!record) throw new TagStructureNotFound();
	if (record.definitionVersion !== 1)
		throw new Error("Unsupported Tag structure definition version");
	const members = await listStructureMembers([record.id], input.localizationLanguages);
	return {
		...record,
		definitionVersion: 1 as const,
		score: toSafeInteger(record.score ?? 0n, "Tag structure score"),
		voteCount: toSafeInteger(record.voteCount ?? 0n, "Tag structure vote count"),
		viewerVote: presentVote(record.viewerVote),
		members: members.get(record.id) ?? [],
	};
}

async function ensureStructureApplication(
	tx: DatabaseTransaction,
	unitId: string,
	structureId: string,
): Promise<void> {
	const [application] = await tx
		.select({ structureId: unitStructureApplication.structureId })
		.from(unitStructureApplication)
		.where(
			and(
				eq(unitStructureApplication.unitId, unitId),
				eq(unitStructureApplication.structureId, structureId),
			),
		)
		.limit(1);
	if (!application) throw new TagStructureApplicationNotFound();
}

async function upsertApplicationVote(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly structureId: string;
		readonly profileId: string;
		readonly value: BinaryVote;
	},
) {
	await tx
		.insert(unitStructureApplicationJudgment)
		.values({
			unitId: input.unitId,
			structureId: input.structureId,
			profileId: input.profileId,
			fitVote: input.value,
			fitUpdatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: [
				unitStructureApplicationJudgment.unitId,
				unitStructureApplicationJudgment.structureId,
				unitStructureApplicationJudgment.profileId,
			],
			set: { fitVote: input.value, fitUpdatedAt: new Date(), updatedAt: new Date() },
		});
}

export async function applyTagStructure(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
	readonly contribution?: RevisionContributionInput;
}) {
	return runVndbVoteTransaction(
		{ family: "tag_structure_application", authority: "global" },
		async (tx) => {
			const [structure] = await tx
				.select({
					id: unitStructure.id,
					memberUnitIds: unitStructure.memberUnitIds,
				})
				.from(unitStructure)
				.where(eq(unitStructure.id, input.structureId))
				.limit(1);
			if (!structure) throw new TagStructureNotFound();
			if (structure.memberUnitIds.includes(input.unitId)) throw new InvalidTagStructure();
			const inserted = await tx
				.insert(unitStructureApplication)
				.values({
					unitId: input.unitId,
					structureId: input.structureId,
					createdByProfileId: input.profileId,
				})
				.onConflictDoNothing()
				.returning({ structureId: unitStructureApplication.structureId });
			await upsertApplicationVote(tx, { ...input, value: 1 });
			if (inserted.length)
				await recordUnitRevision(tx, {
					unitId: input.unitId,
					actorProfileId: input.profileId,
					contribution: input.contribution,
					event: "update",
				});
			return getApplicationVoteSummary(tx, {
				unitId: input.unitId,
				structureId: input.structureId,
				viewerVote: 1,
			});
		},
	);
}

export async function removeTagStructureApplication(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
	readonly contribution?: RevisionContributionInput;
}): Promise<void> {
	await runVndbVoteTransaction(
		{ family: "tag_structure_application", authority: "global" },
		async (tx) => {
			const deleted = await tx
				.delete(unitStructureApplication)
				.where(
					and(
						eq(unitStructureApplication.unitId, input.unitId),
						eq(unitStructureApplication.structureId, input.structureId),
					),
				)
				.returning({ id: unitStructureApplication.structureId });
			if (!deleted.length) throw new TagStructureApplicationNotFound();
			await recordUnitRevision(tx, {
				unitId: input.unitId,
				actorProfileId: input.profileId,
				contribution: input.contribution,
				event: "update",
			});
		},
	);
}

async function getApplicationVoteSummary(
	tx: DatabaseTransaction,
	input: {
		readonly unitId: string;
		readonly structureId: string;
		readonly viewerVote: OptionalBinaryVote;
	},
) {
	const [row] = await tx
		.select({
			score: unitStructureApplicationJudgmentStat.score,
			voteCount: unitStructureApplicationJudgmentStat.voteCount,
		})
		.from(unitStructureApplication)
		.leftJoin(
			unitStructureApplicationJudgmentStat,
			and(
				eq(unitStructureApplicationJudgmentStat.unitId, unitStructureApplication.unitId),
				eq(unitStructureApplicationJudgmentStat.structureId, unitStructureApplication.structureId),
			),
		)
		.where(
			and(
				eq(unitStructureApplication.unitId, input.unitId),
				eq(unitStructureApplication.structureId, input.structureId),
			),
		)
		.limit(1);
	if (!row) throw new TagStructureApplicationNotFound();
	return {
		unitId: input.unitId,
		structureId: input.structureId,
		score: toSafeInteger(row.score ?? 0n, "Tag structure application score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Tag structure application vote count"),
		viewerVote: input.viewerVote,
	};
}

export async function voteTagStructureApplication(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
	readonly value: BinaryVote;
}) {
	return runVndbVoteTransaction(
		{ family: "tag_structure_application", authority: "global" },
		async (tx) => {
			await ensureStructureApplication(tx, input.unitId, input.structureId);
			await upsertApplicationVote(tx, input);
			return getApplicationVoteSummary(tx, { ...input, viewerVote: input.value });
		},
	);
}

export async function deleteTagStructureApplicationVote(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
}) {
	return runVndbVoteTransaction(
		{ family: "tag_structure_application", authority: "global" },
		async (tx) => {
			await ensureStructureApplication(tx, input.unitId, input.structureId);
			const judgmentKey = and(
				eq(unitStructureApplicationJudgment.unitId, input.unitId),
				eq(unitStructureApplicationJudgment.structureId, input.structureId),
				eq(unitStructureApplicationJudgment.profileId, input.profileId),
			);
			await tx
				.delete(unitStructureApplicationJudgment)
				.where(and(judgmentKey, isNull(unitStructureApplicationJudgment.spoilerLevel)));
			await tx
				.update(unitStructureApplicationJudgment)
				.set({ fitVote: null, fitUpdatedAt: null, updatedAt: new Date() })
				.where(and(judgmentKey, isNotNull(unitStructureApplicationJudgment.spoilerLevel)));
			return getApplicationVoteSummary(tx, { ...input, viewerVote: null });
		},
	);
}

export async function listVisibleUnitTagStructures(input: {
	readonly unitId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const rows = await database
		.select({
			structureId: unitStructureApplication.structureId,
			pinned: unitStructureApplication.pinned,
			position: unitStructureApplication.position,
			score: unitStructureApplicationJudgmentStat.score,
			voteCount: unitStructureApplicationJudgmentStat.voteCount,
			viewerVote: viewerApplicationVote.fitVote,
			definitionScore: unitStructureVoteStat.score,
			definitionVoteCount: unitStructureVoteStat.voteCount,
			createdAt: unitStructureApplication.createdAt,
			updatedAt: unitStructureApplication.updatedAt,
		})
		.from(unitStructureApplication)
		.innerJoin(unitStructure, eq(unitStructure.id, unitStructureApplication.structureId))
		.innerJoin(unit, eq(unit.id, unitStructure.id))
		.innerJoin(
			unitStructureApplicationJudgmentStat,
			and(
				eq(unitStructureApplicationJudgmentStat.unitId, unitStructureApplication.unitId),
				eq(unitStructureApplicationJudgmentStat.structureId, unitStructureApplication.structureId),
			),
		)
		.innerJoin(unitStructureVoteStat, eq(unitStructureVoteStat.structureId, unitStructure.id))
		.leftJoin(
			viewerApplicationVote,
			and(
				eq(viewerApplicationVote.unitId, unitStructureApplication.unitId),
				eq(viewerApplicationVote.structureId, unitStructureApplication.structureId),
				input.viewerProfileId
					? eq(viewerApplicationVote.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(
			and(
				eq(unitStructureApplication.unitId, input.unitId),
				sql`${unitStructureApplicationJudgmentStat.score} > 0`,
				gt(unitStructureApplicationJudgmentStat.voteCount, 0n),
				sql`${unitStructureVoteStat.score} > 0`,
				gt(unitStructureVoteStat.voteCount, 0n),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				sql`not exists (
					select 1
					from ${currentUnitStructureMember} member
					join unit member_unit on member_unit.id = member.member_unit_id
					where member.structure_id = ${unitStructure.id}
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
			desc(unitStructureApplication.pinned),
			sql`case when ${unitStructureApplication.pinned} then ${unitStructureApplication.position} end asc nulls last`,
			desc(applicationWilsonConfidence),
			desc(unitStructureApplicationJudgmentStat.score),
			desc(unitStructureApplicationJudgmentStat.voteCount),
			unitStructureApplication.structureId,
		)
		.limit(input.limit);
	const members = await listStructureMembers(
		rows.map(({ structureId }) => structureId),
		input.localizationLanguages,
	);
	return rows.map((row) => ({
		...row,
		score: toSafeInteger(row.score, "Tag structure application score"),
		voteCount: toSafeInteger(row.voteCount, "Tag structure application vote count"),
		viewerVote: presentVote(row.viewerVote),
		definitionScore: toSafeInteger(row.definitionScore ?? 0n, "Tag structure score"),
		definitionVoteCount: toSafeInteger(row.definitionVoteCount ?? 0n, "Tag structure vote count"),
		members: members.get(row.structureId) ?? [],
	}));
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
			parentTagId: currentUnitStructureEdge.parentUnitId,
			childTagId: currentUnitStructureEdge.childUnitId,
			score: unitStructureVoteStat.score,
			voteCount: unitStructureVoteStat.voteCount,
		})
		.from(currentUnitStructureEdge)
		.innerJoin(hierarchyChildUnit, eq(hierarchyChildUnit.id, currentUnitStructureEdge.childUnitId))
		.innerJoin(
			unitStructureVoteStat,
			eq(unitStructureVoteStat.structureId, currentUnitStructureEdge.structureId),
		)
		.where(
			and(
				inArray(currentUnitStructureEdge.parentUnitId, [...parentTagIds]),
				sql`${unitStructureVoteStat.score} > 0`,
				gt(unitStructureVoteStat.voteCount, 0n),
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
			score: toSafeInteger(row.score, "Tag structure score"),
			voteCount: toSafeInteger(row.voteCount, "Tag structure vote count"),
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
