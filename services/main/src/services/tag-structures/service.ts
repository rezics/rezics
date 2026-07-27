import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";
import type { PlatformAuthorization } from "../authorization/platform/authorization";
import { recordAuditEvent } from "../audit";
import { createCommunityOwnedUnitAccess } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { databaseConstraintName } from "../database/constraint";
import { toSafeInteger } from "../database/integer";
import {
	tag,
	unit,
	unitStructure,
	unitStructureApplication,
	unitStructureApplicationVote,
	unitStructureApplicationVoteStat,
	unitStructureEdge,
	unitStructureMember,
	unitStructureVote,
	unitStructureVoteStat,
	UnitStructureMaximumMembers,
	UnitStructureMinimumMembers,
} from "../database/schema";
import { insertUnit } from "../units/create";
import { lockUnitHistory, recordUnitRevision } from "../units/history";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";
import {
	InvalidTagStructure,
	TagNotFound,
	TagStructureApplicationNotFound,
	TagStructureChanged,
	TagStructureDefinitionConflict,
	TagStructureNotFound,
} from "../api/tags/errors";
import { wilsonLowerBound, wilsonLowerBoundSql } from "../tags/ranking";
import { nextUnitStructureDefinitionUpdatedAt, replaceUnitStructureDefinition } from "./definition";

export type BinaryVote = -1 | 1;
export type OptionalBinaryVote = BinaryVote | null;

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
	unitStructureApplicationVote,
	"viewer_tag_structure_application_vote",
);
const applicationWilsonConfidence = wilsonLowerBoundSql(
	unitStructureApplicationVoteStat.score,
	unitStructureApplicationVoteStat.voteCount,
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
	readonly memberTagIds: readonly string[];
	readonly profileId: string;
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
		event: "create",
	});
	return { structureId: created.id, created: true };
}

export async function createTagStructure(
	input: CreateTagStructureInput,
): Promise<{ readonly structureId: string; readonly created: boolean }> {
	return database.transaction((tx) => createTagStructureInTransaction(tx, input));
}

export async function updateTagStructureDefinition(input: {
	readonly structureId: string;
	readonly memberTagIds: readonly string[];
	readonly expectedUpdatedAt: Date;
	readonly reason: string;
	readonly actorProfileId: string;
	readonly authorization: PlatformAuthorization<string>;
}): Promise<{ readonly changed: boolean; readonly updatedAt: Date }> {
	validateMemberTagIds(input.memberTagIds);
	const reason = input.reason.trim();
	if (!reason) throw new InvalidTagStructure();

	return database.transaction(async (tx) => {
		await input.authorization.ensureCapability("unit.edit", tx);
		await lockUnitHistory(tx, input.structureId);
		const [current] = await tx
			.select({
				memberUnitIds: unitStructure.memberUnitIds,
				updatedAt: unitStructure.updatedAt,
			})
			.from(unitStructure)
			.where(eq(unitStructure.id, input.structureId))
			.for("update")
			.limit(1);
		if (!current) throw new TagStructureNotFound();
		if (current.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
			throw new TagStructureChanged(current.updatedAt);
		if (sameOrderedIds(current.memberUnitIds, input.memberTagIds))
			return { changed: false, updatedAt: current.updatedAt };

		await ensureCreatableTags(tx, input.memberTagIds);
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${structurePathKey(input.memberTagIds)}, 0))`,
		);
		const [conflicting] = await tx
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
		if (conflicting && conflicting.id !== input.structureId)
			throw new TagStructureDefinitionConflict(conflicting.id);

		const updatedAt = nextUnitStructureDefinitionUpdatedAt(current.updatedAt);
		await replaceUnitStructureDefinition(tx, {
			structureId: input.structureId,
			memberUnitIds: input.memberTagIds,
			updatedAt,
		});
		await recordUnitRevision(tx, {
			unitId: input.structureId,
			actorProfileId: input.actorProfileId,
			event: "update",
			message: reason,
		});
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "unit", id: input.structureId },
			action: "unit.structure.definition.update",
			reasonCode: "administrative",
			target: { kind: "unit", id: input.structureId },
			details: {
				beforeMemberUnitIds: current.memberUnitIds,
				afterMemberUnitIds: [...input.memberTagIds],
				reason,
			},
		});
		return { changed: true, updatedAt };
	});
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
	const updated = await database.transaction(async (tx) => {
		const [existing] = await tx
			.select({ id: unitStructure.id })
			.from(unitStructure)
			.where(eq(unitStructure.id, input.structureId))
			.limit(1);
		if (!existing) throw new TagStructureNotFound();
		await upsertDefinitionVote(tx, input.structureId, input.profileId, input.value);
		return input.value;
	});
	return getDefinitionVoteSummary(input.structureId, updated);
}

export async function deleteTagStructureVote(input: {
	readonly structureId: string;
	readonly profileId: string;
}) {
	const [existing] = await database
		.select({ id: unitStructure.id })
		.from(unitStructure)
		.where(eq(unitStructure.id, input.structureId))
		.limit(1);
	if (!existing) throw new TagStructureNotFound();
	await database
		.delete(unitStructureVote)
		.where(
			and(
				eq(unitStructureVote.structureId, input.structureId),
				eq(unitStructureVote.profileId, input.profileId),
			),
		);
	return getDefinitionVoteSummary(input.structureId, null);
}

async function listStructureMembers(
	structureIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
) {
	if (structureIds.length === 0) return new Map<string, TagStructureMember[]>();
	const rows = await database
		.select({
			structureId: unitStructureMember.structureId,
			ordinal: unitStructureMember.ordinal,
			tagId: unitStructureMember.memberUnitId,
			language: resolvedUnitLocalizationLanguage(memberUnit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(memberUnit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(memberUnit.id, localizationLanguages),
		})
		.from(unitStructureMember)
		.innerJoin(memberUnit, eq(memberUnit.id, unitStructureMember.memberUnitId))
		.where(inArray(unitStructureMember.structureId, [...structureIds]))
		.orderBy(unitStructureMember.structureId, unitStructureMember.ordinal);
	const grouped = new Map<string, TagStructureMember[]>();
	for (const row of rows) {
		const items = grouped.get(row.structureId) ?? [];
		items.push({
			ordinal: row.ordinal,
			tagId: row.tagId,
			language: row.language,
			title: row.title,
			summary: row.summary,
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
					from unit_structure_member member
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
		.insert(unitStructureApplicationVote)
		.values(input)
		.onConflictDoUpdate({
			target: [
				unitStructureApplicationVote.unitId,
				unitStructureApplicationVote.structureId,
				unitStructureApplicationVote.profileId,
			],
			set: { value: input.value, updatedAt: new Date() },
		});
}

export async function applyTagStructure(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
}) {
	return database.transaction(async (tx) => {
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
				event: "update",
			});
		return getApplicationVoteSummary(tx, {
			unitId: input.unitId,
			structureId: input.structureId,
			viewerVote: 1,
		});
	});
}

export async function removeTagStructureApplication(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
}): Promise<void> {
	await database.transaction(async (tx) => {
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
			event: "update",
		});
	});
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
			score: unitStructureApplicationVoteStat.score,
			voteCount: unitStructureApplicationVoteStat.voteCount,
		})
		.from(unitStructureApplication)
		.leftJoin(
			unitStructureApplicationVoteStat,
			and(
				eq(unitStructureApplicationVoteStat.unitId, unitStructureApplication.unitId),
				eq(
					unitStructureApplicationVoteStat.structureId,
					unitStructureApplication.structureId,
				),
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
	return database.transaction(async (tx) => {
		await ensureStructureApplication(tx, input.unitId, input.structureId);
		await upsertApplicationVote(tx, input);
		return getApplicationVoteSummary(tx, { ...input, viewerVote: input.value });
	});
}

export async function deleteTagStructureApplicationVote(input: {
	readonly unitId: string;
	readonly structureId: string;
	readonly profileId: string;
}) {
	return database.transaction(async (tx) => {
		await ensureStructureApplication(tx, input.unitId, input.structureId);
		await tx
			.delete(unitStructureApplicationVote)
			.where(
				and(
					eq(unitStructureApplicationVote.unitId, input.unitId),
					eq(unitStructureApplicationVote.structureId, input.structureId),
					eq(unitStructureApplicationVote.profileId, input.profileId),
				),
			);
		return getApplicationVoteSummary(tx, { ...input, viewerVote: null });
	});
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
			score: unitStructureApplicationVoteStat.score,
			voteCount: unitStructureApplicationVoteStat.voteCount,
			viewerVote: viewerApplicationVote.value,
			definitionScore: unitStructureVoteStat.score,
			definitionVoteCount: unitStructureVoteStat.voteCount,
			createdAt: unitStructureApplication.createdAt,
			updatedAt: unitStructureApplication.updatedAt,
		})
		.from(unitStructureApplication)
		.innerJoin(unitStructure, eq(unitStructure.id, unitStructureApplication.structureId))
		.innerJoin(unit, eq(unit.id, unitStructure.id))
		.innerJoin(
			unitStructureApplicationVoteStat,
			and(
				eq(unitStructureApplicationVoteStat.unitId, unitStructureApplication.unitId),
				eq(
					unitStructureApplicationVoteStat.structureId,
					unitStructureApplication.structureId,
				),
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
				sql`${unitStructureApplicationVoteStat.score} > 0`,
				sql`${unitStructureVoteStat.score} > 0`,
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
				sql`not exists (
					select 1
					from unit_structure_member member
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
			desc(unitStructureApplicationVoteStat.score),
			desc(unitStructureApplicationVoteStat.voteCount),
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
		definitionVoteCount: toSafeInteger(
			row.definitionVoteCount ?? 0n,
			"Tag structure vote count",
		),
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
			parentTagId: unitStructureEdge.parentUnitId,
			childTagId: unitStructureEdge.childUnitId,
			score: unitStructureVoteStat.score,
			voteCount: unitStructureVoteStat.voteCount,
		})
		.from(unitStructureEdge)
		.innerJoin(hierarchyChildUnit, eq(hierarchyChildUnit.id, unitStructureEdge.childUnitId))
		.innerJoin(
			unitStructureVoteStat,
			eq(unitStructureVoteStat.structureId, unitStructureEdge.structureId),
		)
		.where(
			and(
				inArray(unitStructureEdge.parentUnitId, [...parentTagIds]),
				sql`${unitStructureVoteStat.score} > 0`,
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
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly childLimit: number;
	readonly grandchildLimit: number;
}) {
	const [tagRecord] = await database
		.select({ id: tag.id })
		.from(tag)
		.innerJoin(unit, eq(unit.id, tag.id))
		.where(
			and(
				eq(tag.id, input.tagId),
				eq(unit.status, "published"),
				eq(unit.visibility, "public"),
				eq(unit.moderationStatus, "approved"),
				isNull(unit.deletedAt),
			),
		)
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
