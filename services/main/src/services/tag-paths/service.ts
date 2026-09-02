import { createHash } from "node:crypto";

import type { ContentLanguage } from "@rezics/i18n";
import {
	and,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	sql,
	type SQL,
	type SQLWrapper,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { createCommunityOwnedUnitAccess } from "../authorization/unit/ownership";
import { database, type DatabaseTransaction } from "../database";
import { databaseConstraintName } from "../database/constraint";
import { toSafeInteger } from "../database/integer";
import {
	guideNodeLocalization,
	realm,
	realmTagPath,
	realmTagPathSense,
	realmTagPathVote,
	realmTagPathVoteStat,
	realmTagJudgment,
	realmTagJudgmentStat,
	realmUnitTag,
	realmUnitTagPathApplication,
	realmUnitTagPathApplicationJudgment,
	realmUnitTagPathApplicationJudgmentStat,
	tag,
	tagExpression,
	tagExpressionArgument,
	tagExpressionGroupKey,
	tagExpressionInferenceRule,
	tagExpressionLabelComponent,
	tagExpressionPresentationRevision,
	tagPath,
	tagPathMember,
	tagPathMerge,
	tagPathSense,
	tagPathSenseBinding,
	tagPathVote,
	tagPathVoteStat,
	tagRelation,
	unit,
	unitAlias,
	unitLocalization,
	unitTagPathApplication,
	unitTagPathApplicationJudgment,
	unitTagPathApplicationJudgmentStat,
	unitTag,
	unitTagJudgment,
	unitTagJudgmentStat,
	vocabularyNode,
	TagPathMaximumMembers,
	TagPathMinimumMembers,
	type TagExpressionArgumentRole,
	type TagPathAssistanceProvenance,
	type TagPathMergeProposalSourceKind,
	type TagPathSenseScope,
	type TagRelationKind,
} from "../database/schema";
import { runVoteTransaction } from "../database/vote-admission";
import { RealmNotFound } from "../api/realms/errors";
import {
	InvalidTagPath,
	InvalidTagPathMerge,
	TagNotFound,
	TagPathApplicationNotFound,
	TagPathDefinitionConflict,
	TagPathMergeNotFound,
	TagPathNotFound,
} from "../api/tags/errors";
import { insertUnit } from "../units/create";
import { presentAvatar } from "../units/avatar";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";

export type BinaryVote = -1 | 1;
export type OptionalBinaryVote = BinaryVote | null;
export type SpoilerLevel = 0 | 1 | 2;

const memberUnit = alias(unit, "tag_path_member_unit");
const componentUnit = alias(unit, "tag_expression_component_unit");
const inferenceTargetUnit = alias(unit, "tag_expression_inference_target_unit");
const senseRealmUnit = alias(unit, "tag_path_sense_realm_unit");
const viewerDefinitionVote = alias(tagPathVote, "viewer_tag_path_vote");
const viewerApplicationJudgment = alias(
	unitTagPathApplicationJudgment,
	"viewer_tag_path_application_judgment",
);
const viewerRealmDefinitionVote = alias(realmTagPathVote, "viewer_realm_tag_path_vote");
const viewerRealmApplicationJudgment = alias(
	realmUnitTagPathApplicationJudgment,
	"viewer_realm_tag_path_application_judgment",
);
const viewerDirectTagJudgment = alias(unitTagJudgment, "viewer_direct_tag_judgment");
const viewerRealmDirectTagJudgment = alias(realmTagJudgment, "viewer_realm_direct_tag_judgment");
const acceptedMerge = alias(tagPathMerge, "accepted_tag_path_merge");

function toTextArray(values: readonly string[]): SQL {
	return sql`array[${sql.join(
		values.map((value) => sql`${value}`),
		sql`, `,
	)}]::text[]`;
}

function toUuidArray(values: readonly string[]): SQL {
	return sql`array[${sql.join(
		values.map((value) => sql`${value}::uuid`),
		sql`, `,
	)}]::uuid[]`;
}

export function toTagPathConstraintError(error: unknown): InvalidTagPath | undefined {
	const constraint = databaseConstraintName(error);
	if (
		constraint?.startsWith("tag_path_") ||
		constraint?.startsWith("tag_expression_") ||
		constraint?.startsWith("tag_relation_") ||
		constraint?.startsWith("unit_tag_path_application_") ||
		constraint?.startsWith("realm_unit_tag_path_application_")
	)
		return new InvalidTagPath();
	return undefined;
}

function presentVote(value: number | null): OptionalBinaryVote {
	if (value === null || value === -1 || value === 1) return value;
	throw new Error("Stored Tag Path vote has an invalid value");
}

function presentSpoilerLevel(value: number | null): SpoilerLevel | null {
	if (value === null || value === 0 || value === 1 || value === 2) return value;
	throw new Error("Stored Tag Path spoiler level is invalid");
}

function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((id, index) => id === right[index]);
}

function validatePathStructure(
	memberNodeIds: readonly string[],
	relationIds: readonly string[],
): void {
	if (
		memberNodeIds.length < TagPathMinimumMembers ||
		memberNodeIds.length > TagPathMaximumMembers ||
		new Set(memberNodeIds).size !== memberNodeIds.length ||
		relationIds.length !== memberNodeIds.length - 1 ||
		new Set(relationIds).size !== relationIds.length
	)
		throw new InvalidTagPath();
}

function structuralIdentityHash(
	memberNodeIds: readonly string[],
	relationIds: readonly string[],
): string {
	return createHash("sha256").update(JSON.stringify({ memberNodeIds, relationIds })).digest("hex");
}

async function ensureCreatableStructure(
	tx: DatabaseTransaction,
	memberNodeIds: readonly string[],
	relationIds: readonly string[],
): Promise<void> {
	const nodes = await tx
		.select({ id: vocabularyNode.id, status: vocabularyNode.status })
		.from(vocabularyNode)
		.where(inArray(vocabularyNode.id, [...memberNodeIds]));
	if (nodes.length !== memberNodeIds.length || nodes.some((node) => node.status !== "active"))
		throw new TagNotFound();
	const relations = await tx
		.select({
			id: tagRelation.id,
			parentNodeId: tagRelation.parentNodeId,
			childNodeId: tagRelation.childNodeId,
			status: tagRelation.status,
		})
		.from(tagRelation)
		.where(inArray(tagRelation.id, [...relationIds]));
	if (relations.length !== relationIds.length) throw new InvalidTagPath();
	const byId = new Map(relations.map((relation) => [relation.id, relation] as const));
	for (const [index, relationId] of relationIds.entries()) {
		const relation = byId.get(relationId);
		if (
			!relation ||
			relation.status !== "active" ||
			relation.parentNodeId !== memberNodeIds[index] ||
			relation.childNodeId !== memberNodeIds[index + 1]
		)
			throw new InvalidTagPath();
	}
}

/**
 * Creates one governed vocabulary edge. Relation writes are definition-scale,
 * so a graph-wide advisory lock gives concurrent inverse-edge proposals a
 * single serial order while keeping Unit application paths lock-free.
 */
export async function createTagRelation(input: {
	readonly parentNodeId: string;
	readonly childNodeId: string;
	readonly relationKind: TagRelationKind;
	readonly provenance?: Readonly<Record<string, unknown>>;
	readonly profileId: string;
}) {
	if (input.parentNodeId === input.childNodeId) throw new InvalidTagPath();
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended('tag-relation-graph'::text, 0))`,
		);
		const nodes = await tx
			.select({ id: vocabularyNode.id, status: vocabularyNode.status })
			.from(vocabularyNode)
			.where(inArray(vocabularyNode.id, [input.parentNodeId, input.childNodeId]));
		if (nodes.length !== 2 || nodes.some((node) => node.status !== "active"))
			throw new TagNotFound();
		const [existing] = await tx
			.select({ id: tagRelation.id, revision: tagRelation.revision })
			.from(tagRelation)
			.where(
				and(
					eq(tagRelation.parentNodeId, input.parentNodeId),
					eq(tagRelation.childNodeId, input.childNodeId),
					eq(tagRelation.relationKind, input.relationKind),
					eq(tagRelation.status, "active"),
				),
			)
			.limit(1);
		if (existing)
			return { relationId: existing.id, revision: existing.revision, created: false as const };
		const reachability = await tx.execute<{ readonly wouldCycle: boolean }>(sql`
			with recursive descendant(node_id) as (
				select ${input.childNodeId}::uuid
				union
				select relation.child_node_id
				from public.tag_relation relation
				join descendant on descendant.node_id = relation.parent_node_id
				where relation.status = 'active'
			)
			select exists(
				select 1 from descendant where node_id = ${input.parentNodeId}::uuid
			) as "wouldCycle"
		`);
		if (reachability.rows[0]?.wouldCycle) throw new InvalidTagPath();
		const [revisionRow] = await tx
			.select({ revision: sql<number>`coalesce(max(${tagRelation.revision}), 0)` })
			.from(tagRelation)
			.where(
				and(
					eq(tagRelation.parentNodeId, input.parentNodeId),
					eq(tagRelation.childNodeId, input.childNodeId),
					eq(tagRelation.relationKind, input.relationKind),
				),
			);
		const revision = (revisionRow?.revision ?? 0) + 1;
		const [created] = await tx
			.insert(tagRelation)
			.values({
				parentNodeId: input.parentNodeId,
				childNodeId: input.childNodeId,
				relationKind: input.relationKind,
				revision,
				provenance: input.provenance,
				createdByProfileId: input.profileId,
			})
			.returning({ id: tagRelation.id });
		if (!created) throw new InvalidTagPath();
		return { relationId: created.id, revision, created: true as const };
	});
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
	readonly memberNodeIds: readonly string[];
	readonly relationIds: readonly string[];
	readonly profileId: string;
	readonly createdAt?: Date;
}

/** Creates only structural identity. Assertion/display configuration is intentionally absent. */
export async function createTagPathInTransaction(
	tx: DatabaseTransaction,
	input: CreateTagPathInput,
): Promise<{ readonly pathId: string; readonly created: boolean }> {
	validatePathStructure(input.memberNodeIds, input.relationIds);
	const identityHash = structuralIdentityHash(input.memberNodeIds, input.relationIds);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`tag-path:${identityHash}`}::text, 0))`,
	);
	await ensureCreatableStructure(tx, input.memberNodeIds, input.relationIds);
	if (input.pathId) {
		const [declared] = await tx
			.select({
				kind: unit.kind,
				memberNodeIds: tagPath.memberNodeIds,
				relationIds: tagPath.relationIds,
			})
			.from(unit)
			.leftJoin(tagPath, eq(tagPath.id, unit.id))
			.where(eq(unit.id, input.pathId))
			.limit(1);
		if (declared) {
			if (
				declared.kind !== "tag_path" ||
				!declared.memberNodeIds ||
				!declared.relationIds ||
				!sameOrderedIds(declared.memberNodeIds, input.memberNodeIds) ||
				!sameOrderedIds(declared.relationIds, input.relationIds)
			)
				throw new TagPathDefinitionConflict(input.pathId);
			await upsertDefinitionVote(tx, input.pathId, input.profileId, 1, input.createdAt);
			return { pathId: input.pathId, created: false };
		}
	}
	const [existing] = await tx
		.select({ id: tagPath.id })
		.from(tagPath)
		.where(eq(tagPath.structuralIdentityHash, identityHash))
		.limit(1);
	if (existing) {
		await upsertDefinitionVote(tx, existing.id, input.profileId, 1, input.createdAt);
		return { pathId: existing.id, created: false };
	}
	const createdAt = input.createdAt ?? new Date();
	const createdUnit = await insertUnit(tx, {
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
		id: createdUnit.id,
		memberNodeIds: [...input.memberNodeIds],
		relationIds: [...input.relationIds],
		structuralIdentityHash: identityHash,
		terminalNodeId: input.memberNodeIds.at(-1)!,
		createdByProfileId: input.profileId,
		createdAt,
	});
	await createCommunityOwnedUnitAccess(tx, createdUnit.id);
	await upsertDefinitionVote(tx, createdUnit.id, input.profileId, 1, createdAt);
	return { pathId: createdUnit.id, created: true };
}

export async function createTagPath(input: CreateTagPathInput) {
	return runVoteTransaction({ family: "tag_path", authority: "global" }, (tx) =>
		createTagPathInTransaction(tx, input),
	);
}

export type TagPathSenseBindingInput = {
	readonly memberOrdinal: number;
	readonly argumentRole: TagExpressionArgumentRole;
	readonly argumentOrdinal: number;
};

export type CreateTagPathSenseInput = {
	readonly senseId?: string;
	readonly pathId: string;
	readonly expressionId: string;
	readonly scope: TagPathSenseScope;
	readonly realmId?: string;
	readonly bindings: readonly TagPathSenseBindingInput[];
	readonly provenance?: Readonly<Record<string, unknown>>;
	readonly profileId: string;
	readonly createdAt?: Date;
};

function bindingSignature(bindings: readonly TagPathSenseBindingInput[]): string {
	return JSON.stringify(
		[...bindings].sort(
			(left, right) =>
				left.memberOrdinal - right.memberOrdinal ||
				left.argumentRole.localeCompare(right.argumentRole) ||
				left.argumentOrdinal - right.argumentOrdinal,
		),
	);
}

/** Creates an immutable Path-to-Expression interpretation after validating every member binding. */
export async function createTagPathSenseInTransaction(
	tx: DatabaseTransaction,
	input: CreateTagPathSenseInput,
): Promise<{ readonly senseId: string; readonly created: boolean }> {
	if (
		input.bindings.length === 0 ||
		(input.scope === "global" && input.realmId !== undefined) ||
		(input.scope === "realm" && input.realmId === undefined)
	)
		throw new InvalidTagPath();
	const signature = bindingSignature(input.bindings);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`tag-path-sense:${input.pathId}:${input.expressionId}:${input.realmId ?? "global"}:${signature}`}::text, 0))`,
	);
	const [pathRecord, expressionRecord] = await Promise.all([
		tx
			.select({ id: tagPath.id, memberNodeIds: tagPath.memberNodeIds })
			.from(tagPath)
			.where(eq(tagPath.id, input.pathId))
			.limit(1),
		tx
			.select({ id: tagExpression.id })
			.from(tagExpression)
			.where(
				and(
					eq(tagExpression.id, input.expressionId),
					eq(tagExpression.status, "active"),
					isNotNull(tagExpression.sealedAt),
				),
			)
			.limit(1),
	]);
	const pathIdentity = pathRecord[0];
	if (!pathIdentity || !expressionRecord[0]) throw new TagPathNotFound();
	const arguments_ = await tx
		.select({
			role: tagExpressionArgument.role,
			ordinal: tagExpressionArgument.ordinal,
			tagId: tagExpressionArgument.tagId,
		})
		.from(tagExpressionArgument)
		.where(eq(tagExpressionArgument.expressionId, input.expressionId));
	for (const binding of input.bindings) {
		const memberNodeId = pathIdentity.memberNodeIds[binding.memberOrdinal];
		if (
			!memberNodeId ||
			!arguments_.some(
				(argument) =>
					argument.role === binding.argumentRole &&
					argument.ordinal === binding.argumentOrdinal &&
					argument.tagId === memberNodeId,
			)
		)
			throw new InvalidTagPath();
	}
	const identityWhere = and(
		eq(tagPathSense.pathId, input.pathId),
		eq(tagPathSense.expressionId, input.expressionId),
		eq(tagPathSense.scope, input.scope),
		input.realmId ? eq(tagPathSense.realmId, input.realmId) : isNull(tagPathSense.realmId),
		eq(tagPathSense.bindingSignature, signature),
	);
	const [existing] = await tx
		.select({ id: tagPathSense.id, status: tagPathSense.status })
		.from(tagPathSense)
		.where(identityWhere)
		.limit(1);
	if (existing) {
		if (existing.status !== "active") throw new InvalidTagPath();
		return { senseId: existing.id, created: false };
	}
	if (input.senseId) {
		const [collision] = await tx
			.select({ id: tagPathSense.id })
			.from(tagPathSense)
			.where(eq(tagPathSense.id, input.senseId))
			.limit(1);
		if (collision) throw new InvalidTagPath();
	}
	const [created] = await tx
		.insert(tagPathSense)
		.values({
			id: input.senseId,
			pathId: input.pathId,
			expressionId: input.expressionId,
			scope: input.scope,
			realmId: input.realmId,
			bindingSignature: signature,
			provenance: input.provenance,
			createdByProfileId: input.profileId,
			createdAt: input.createdAt,
		})
		.returning({ id: tagPathSense.id });
	if (!created) throw new Error("Tag Path Sense was not created");
	await tx
		.insert(tagPathSenseBinding)
		.values(input.bindings.map((binding) => ({ senseId: created.id, ...binding })));
	await tx
		.update(tagPathSense)
		.set({ sealedAt: input.createdAt ?? new Date() })
		.where(eq(tagPathSense.id, created.id));
	return { senseId: created.id, created: true };
}

export async function createTagPathSense(input: CreateTagPathSenseInput) {
	return database.transaction((tx) => createTagPathSenseInTransaction(tx, input));
}

/** Retires one immutable Path Sense without rewriting existing Applications. */
export async function retireTagPathSense(input: {
	readonly pathId: string;
	readonly senseId: string;
	readonly retiredAt?: Date;
}): Promise<{ readonly senseId: string; readonly retired: boolean }> {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`tag-path-sense-id:${input.senseId}`}::text, 0))`,
		);
		const [sense] = await tx
			.select({ id: tagPathSense.id, status: tagPathSense.status })
			.from(tagPathSense)
			.where(and(eq(tagPathSense.id, input.senseId), eq(tagPathSense.pathId, input.pathId)))
			.limit(1);
		if (!sense) throw new TagPathNotFound();
		if (sense.status === "retired") return { senseId: sense.id, retired: false };
		await tx
			.update(tagPathSense)
			.set({ status: "retired", retiredAt: input.retiredAt ?? new Date() })
			.where(eq(tagPathSense.id, sense.id));
		return { senseId: sense.id, retired: true };
	});
}

export type TagPathMember = {
	readonly ordinal: number;
	readonly nodeId: string;
	readonly nodeKind: "concept" | "guide";
	readonly incomingRelation: {
		readonly relationId: string;
		readonly relationKind: TagRelationKind;
	} | null;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: ReturnType<typeof presentAvatar>;
};

function guideTitleSql(nodeId: SQLWrapper, languages: LocalizationLanguageQuery = []) {
	const languageArray = toTextArray(languages);
	return sql<string | null>`(
		select localization.title
		from ${guideNodeLocalization} localization
		where localization.node_id = ${nodeId}
			and ${languages.length ? sql`localization.language = any(${languageArray})` : sql`true`}
		order by ${
			languages.length
				? sql`array_position(${languageArray}, localization.language)`
				: sql`localization.language`
		}
		limit 1
	)`;
}

export async function listPathMembers(
	pathIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
): Promise<Map<string, TagPathMember[]>> {
	if (pathIds.length === 0) return new Map();
	const rows = await database
		.select({
			pathId: tagPathMember.pathId,
			ordinal: tagPathMember.ordinal,
			nodeId: tagPathMember.nodeId,
			nodeKind: vocabularyNode.kind,
			relationId: tagPathMember.incomingRelationId,
			relationKind: tagRelation.relationKind,
			language: resolvedUnitLocalizationLanguage(memberUnit.id, localizationLanguages),
			tagTitle: resolvedUnitLocalizationTitle(memberUnit.id, localizationLanguages),
			guideTitle: guideTitleSql(tagPathMember.nodeId, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(memberUnit.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(memberUnit.id, localizationLanguages),
		})
		.from(tagPathMember)
		.innerJoin(vocabularyNode, eq(vocabularyNode.id, tagPathMember.nodeId))
		.leftJoin(memberUnit, eq(memberUnit.id, tagPathMember.nodeId))
		.leftJoin(tagRelation, eq(tagRelation.id, tagPathMember.incomingRelationId))
		.where(inArray(tagPathMember.pathId, [...pathIds]))
		.orderBy(tagPathMember.pathId, tagPathMember.ordinal);
	const grouped = new Map<string, TagPathMember[]>();
	for (const row of rows) {
		const members = grouped.get(row.pathId) ?? [];
		members.push({
			ordinal: row.ordinal,
			nodeId: row.nodeId,
			nodeKind: row.nodeKind,
			incomingRelation:
				row.relationId && row.relationKind
					? { relationId: row.relationId, relationKind: row.relationKind }
					: null,
			language: row.nodeKind === "concept" ? row.language : null,
			title: row.nodeKind === "concept" ? row.tagTitle : row.guideTitle,
			summary: row.nodeKind === "concept" ? row.summary : null,
			avatar: row.nodeKind === "concept" ? presentAvatar(row.avatar) : null,
		});
		grouped.set(row.pathId, members);
	}
	return grouped;
}

export type TagExpressionComponent = {
	readonly tagId: string;
	readonly semanticRole: TagExpressionArgumentRole;
	readonly componentKind: "required" | "fallback";
	readonly language: ContentLanguage | null;
	readonly title: string | null;
};

export type TagExpressionDefinition = {
	readonly expressionId: string;
	readonly expressionKind: "simple" | "facet_value" | "relation";
	readonly focusTagId: string;
	readonly presentationRevision: number;
	readonly components: TagExpressionComponent[];
	readonly groupKey: {
		readonly tagId: string;
		readonly semanticRole: TagExpressionArgumentRole;
		readonly language: ContentLanguage | null;
		readonly title: string | null;
	} | null;
};

export async function listExpressionDefinitions(
	expressionIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
): Promise<Map<string, TagExpressionDefinition>> {
	if (expressionIds.length === 0) return new Map();
	const [expressions, components, groups] = await Promise.all([
		database
			.select({
				expressionId: tagExpression.id,
				expressionKind: tagExpression.expressionKind,
				focusTagId: tagExpression.focusTagId,
				presentationId: tagExpressionPresentationRevision.id,
				presentationRevision: tagExpressionPresentationRevision.revision,
			})
			.from(tagExpression)
			.innerJoin(
				tagExpressionPresentationRevision,
				and(
					eq(tagExpressionPresentationRevision.expressionId, tagExpression.id),
					eq(tagExpressionPresentationRevision.status, "active"),
					isNotNull(tagExpressionPresentationRevision.sealedAt),
				),
			)
			.where(inArray(tagExpression.id, [...expressionIds])),
		database
			.select({
				expressionId: tagExpressionPresentationRevision.expressionId,
				ordinal: tagExpressionLabelComponent.ordinal,
				tagId: tagExpressionLabelComponent.tagId,
				semanticRole: tagExpressionLabelComponent.semanticRole,
				componentKind: tagExpressionLabelComponent.componentKind,
				language: resolvedUnitLocalizationLanguage(componentUnit.id, localizationLanguages),
				title: resolvedUnitLocalizationTitle(componentUnit.id, localizationLanguages),
			})
			.from(tagExpressionLabelComponent)
			.innerJoin(
				tagExpressionPresentationRevision,
				and(
					eq(
						tagExpressionPresentationRevision.id,
						tagExpressionLabelComponent.presentationRevisionId,
					),
					eq(tagExpressionPresentationRevision.status, "active"),
					isNotNull(tagExpressionPresentationRevision.sealedAt),
				),
			)
			.innerJoin(componentUnit, eq(componentUnit.id, tagExpressionLabelComponent.tagId))
			.where(inArray(tagExpressionPresentationRevision.expressionId, [...expressionIds]))
			.orderBy(tagExpressionPresentationRevision.expressionId, tagExpressionLabelComponent.ordinal),
		database
			.select({
				expressionId: tagExpressionPresentationRevision.expressionId,
				tagId: tagExpressionGroupKey.tagId,
				semanticRole: tagExpressionGroupKey.semanticRole,
				language: resolvedUnitLocalizationLanguage(componentUnit.id, localizationLanguages),
				title: resolvedUnitLocalizationTitle(componentUnit.id, localizationLanguages),
			})
			.from(tagExpressionGroupKey)
			.innerJoin(
				tagExpressionPresentationRevision,
				and(
					eq(tagExpressionPresentationRevision.id, tagExpressionGroupKey.presentationRevisionId),
					eq(tagExpressionPresentationRevision.status, "active"),
					isNotNull(tagExpressionPresentationRevision.sealedAt),
				),
			)
			.innerJoin(componentUnit, eq(componentUnit.id, tagExpressionGroupKey.tagId))
			.where(inArray(tagExpressionPresentationRevision.expressionId, [...expressionIds])),
	]);
	const componentsByExpression = new Map<string, TagExpressionComponent[]>();
	for (const component of components) {
		const values = componentsByExpression.get(component.expressionId) ?? [];
		values.push({
			tagId: component.tagId,
			semanticRole: component.semanticRole,
			componentKind: component.componentKind,
			language: component.language,
			title: component.title,
		});
		componentsByExpression.set(component.expressionId, values);
	}
	const groupByExpression = new Map(groups.map((group) => [group.expressionId, group] as const));
	return new Map(
		expressions.map((expression) => {
			const group = groupByExpression.get(expression.expressionId);
			return [
				expression.expressionId,
				{
					expressionId: expression.expressionId,
					expressionKind: expression.expressionKind,
					focusTagId: expression.focusTagId,
					presentationRevision: expression.presentationRevision,
					components: componentsByExpression.get(expression.expressionId) ?? [],
					groupKey: group
						? {
								tagId: group.tagId,
								semanticRole: group.semanticRole,
								language: group.language,
								title: group.title,
							}
						: null,
				},
			] as const;
		}),
	);
}

export async function getTagPath(input: {
	readonly pathId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
}) {
	const [record] = await database
		.select({
			pathId: tagPath.id,
			structuralIdentityHash: tagPath.structuralIdentityHash,
			terminalNodeId: tagPath.terminalNodeId,
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
				isNull(unit.deletedAt),
			),
		)
		.limit(1);
	if (!record) throw new TagPathNotFound();
	const senses = await database
		.select({
			senseId: tagPathSense.id,
			expressionId: tagPathSense.expressionId,
			scope: tagPathSense.scope,
			realmId: tagPathSense.realmId,
			realmLanguage: resolvedUnitLocalizationLanguage(
				senseRealmUnit.id,
				input.localizationLanguages,
			),
			realmTitle: resolvedUnitLocalizationTitle(senseRealmUnit.id, input.localizationLanguages),
			bindingSignature: tagPathSense.bindingSignature,
			status: tagPathSense.status,
		})
		.from(tagPathSense)
		.leftJoin(senseRealmUnit, eq(senseRealmUnit.id, tagPathSense.realmId))
		.where(eq(tagPathSense.pathId, input.pathId))
		.orderBy(tagPathSense.createdAt, tagPathSense.id);
	const [members, expressions] = await Promise.all([
		listPathMembers([record.pathId], input.localizationLanguages),
		listExpressionDefinitions(
			senses.map((sense) => sense.expressionId),
			input.localizationLanguages,
		),
	]);
	const bindings = senses.length
		? await database
				.select({
					senseId: tagPathSenseBinding.senseId,
					memberOrdinal: tagPathSenseBinding.memberOrdinal,
					argumentRole: tagPathSenseBinding.argumentRole,
					argumentOrdinal: tagPathSenseBinding.argumentOrdinal,
				})
				.from(tagPathSenseBinding)
				.where(
					inArray(
						tagPathSenseBinding.senseId,
						senses.map((sense) => sense.senseId),
					),
				)
				.orderBy(tagPathSenseBinding.senseId, tagPathSenseBinding.memberOrdinal)
		: [];
	const inferenceRules = senses.length
		? await database
				.select({
					ruleId: tagExpressionInferenceRule.id,
					sourceExpressionId: tagExpressionInferenceRule.sourceExpressionId,
					targetTagId: tagExpressionInferenceRule.targetTagId,
					targetExpressionId: tagExpressionInferenceRule.targetExpressionId,
					inferenceKind: tagExpressionInferenceRule.inferenceKind,
					revision: tagExpressionInferenceRule.revision,
					status: tagExpressionInferenceRule.status,
					provenance: tagExpressionInferenceRule.provenance,
					createdAt: tagExpressionInferenceRule.createdAt,
					targetTagLanguage: resolvedUnitLocalizationLanguage(
						inferenceTargetUnit.id,
						input.localizationLanguages,
					),
					targetTagTitle: resolvedUnitLocalizationTitle(
						inferenceTargetUnit.id,
						input.localizationLanguages,
					),
				})
				.from(tagExpressionInferenceRule)
				.leftJoin(
					inferenceTargetUnit,
					eq(inferenceTargetUnit.id, tagExpressionInferenceRule.targetTagId),
				)
				.where(
					inArray(
						tagExpressionInferenceRule.sourceExpressionId,
						senses.map((sense) => sense.expressionId),
					),
				)
				.orderBy(
					tagExpressionInferenceRule.sourceExpressionId,
					tagExpressionInferenceRule.inferenceKind,
					tagExpressionInferenceRule.id,
				)
		: [];
	const targetExpressionDefinitions = await listExpressionDefinitions(
		inferenceRules.flatMap((rule) => (rule.targetExpressionId ? [rule.targetExpressionId] : [])),
		input.localizationLanguages,
	);
	const bindingsBySense = new Map<string, TagPathSenseBindingInput[]>();
	for (const binding of bindings) {
		const values = bindingsBySense.get(binding.senseId) ?? [];
		values.push(binding);
		bindingsBySense.set(binding.senseId, values);
	}
	const rulesByExpression = new Map<string, typeof inferenceRules>();
	for (const rule of inferenceRules) {
		const values = rulesByExpression.get(rule.sourceExpressionId) ?? [];
		values.push(rule);
		rulesByExpression.set(rule.sourceExpressionId, values);
	}
	return {
		...record,
		score: toSafeInteger(record.score ?? 0n, "Tag Path score"),
		voteCount: toSafeInteger(record.voteCount ?? 0n, "Tag Path vote count"),
		usageCount: toSafeInteger(record.usageCount ?? 0n, "Tag Path usage count"),
		viewerVote: presentVote(record.viewerVote),
		members: members.get(record.pathId) ?? [],
		senses: senses.map((sense) => ({
			...sense,
			bindings: bindingsBySense.get(sense.senseId) ?? [],
			expression: expressions.get(sense.expressionId) ?? null,
			inferenceRules: (rulesByExpression.get(sense.expressionId) ?? []).map((rule) => ({
				ruleId: rule.ruleId,
				inferenceKind: rule.inferenceKind,
				revision: rule.revision,
				status: rule.status,
				provenance: rule.provenance,
				createdAt: rule.createdAt,
				target: rule.targetTagId
					? {
							kind: "tag" as const,
							tagId: rule.targetTagId,
							language: rule.targetTagLanguage,
							title: rule.targetTagTitle,
						}
					: {
							kind: "expression" as const,
							expressionId: rule.targetExpressionId!,
							expression: targetExpressionDefinitions.get(rule.targetExpressionId!) ?? null,
						},
			})),
		})),
	};
}

export async function voteTagPath(input: {
	readonly pathId: string;
	readonly profileId: string;
	readonly value: BinaryVote;
}) {
	await runVoteTransaction({ family: "tag_path", authority: "global" }, async (tx) => {
		const [path] = await tx
			.select({ id: tagPath.id })
			.from(tagPath)
			.where(eq(tagPath.id, input.pathId));
		if (!path) throw new TagPathNotFound();
		await upsertDefinitionVote(tx, input.pathId, input.profileId, input.value);
	});
	return getDefinitionVoteSummary(input.pathId, input.profileId);
}

export async function deleteTagPathVote(input: {
	readonly pathId: string;
	readonly profileId: string;
}) {
	await runVoteTransaction({ family: "tag_path", authority: "global" }, (tx) =>
		tx
			.delete(tagPathVote)
			.where(and(eq(tagPathVote.pathId, input.pathId), eq(tagPathVote.profileId, input.profileId))),
	);
	return getDefinitionVoteSummary(input.pathId, null);
}

async function getDefinitionVoteSummary(pathId: string, profileId: string | null) {
	const viewer = alias(tagPathVote, "summary_viewer_tag_path_vote");
	const [row] = await database
		.select({
			score: tagPathVoteStat.score,
			voteCount: tagPathVoteStat.voteCount,
			viewerVote: viewer.value,
		})
		.from(tagPath)
		.leftJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.leftJoin(
			viewer,
			and(eq(viewer.pathId, tagPath.id), profileId ? eq(viewer.profileId, profileId) : sql`false`),
		)
		.where(eq(tagPath.id, pathId))
		.limit(1);
	if (!row) throw new TagPathNotFound();
	return {
		score: toSafeInteger(row.score ?? 0n, "Tag Path score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Tag Path vote count"),
		viewerVote: presentVote(row.viewerVote),
	};
}

export async function listTagPathDefinitionWarnings(input: {
	readonly memberNodeIds: readonly string[];
	readonly relationIds: readonly string[];
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	validatePathStructure(input.memberNodeIds, input.relationIds);
	const rows = await database
		.select({
			pathId: tagPath.id,
			memberNodeIds: tagPath.memberNodeIds,
			relationIds: tagPath.relationIds,
			usageCount: tagPathVoteStat.usageCount,
		})
		.from(tagPath)
		.leftJoin(tagPathVoteStat, eq(tagPathVoteStat.pathId, tagPath.id))
		.where(eq(tagPath.terminalNodeId, input.memberNodeIds.at(-1)!))
		.orderBy(desc(tagPathVoteStat.usageCount), tagPath.id)
		.limit(input.limit);
	const members = await listPathMembers(
		rows.map((row) => row.pathId),
		input.localizationLanguages,
	);
	return rows.map((row) => ({
		pathId: row.pathId,
		kind:
			sameOrderedIds(row.memberNodeIds, input.memberNodeIds) &&
			sameOrderedIds(row.relationIds, input.relationIds)
				? ("exact" as const)
				: ("same_terminal" as const),
		usageCount: toSafeInteger(row.usageCount ?? 0n, "Tag Path usage count"),
		members: members.get(row.pathId) ?? [],
	}));
}

type AcceptedTagPathCandidate = {
	readonly pathId: string;
	readonly score: unknown;
	readonly usageCount: unknown;
	readonly voteCount: unknown;
};

/** @internal Selects one accepted page without skipping accepted rows after the item limit. */
export function paginateAcceptedTagPathCandidates(input: {
	readonly candidates: readonly AcceptedTagPathCandidate[];
	readonly itemLimit: number;
	readonly scanLimit: number;
}) {
	const scanRows = input.candidates.slice(0, input.scanLimit);
	const acceptedRows = scanRows.filter(
		(row) =>
			toSafeInteger(row.score, "Tag Path score") > 0 &&
			toSafeInteger(row.voteCount, "Tag Path vote count") > 0,
	);
	const pageRows = acceptedRows.slice(0, input.itemLimit);
	return {
		pageRows,
		nextCursor:
			acceptedRows.length > input.itemLimit
				? (pageRows.at(-1)?.pathId ?? null)
				: input.candidates.length > input.scanLimit
					? (scanRows.at(-1)?.pathId ?? null)
					: null,
	};
}

export async function listAcceptedTagPathsContaining(input: {
	readonly tagId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
	readonly cursor?: string;
}) {
	// Bound membership/stat intersection work independently of corpus size. A
	// sparse acceptance page may contain fewer than `limit` items and advance
	// with `nextCursor`; callers never make one request scan an unbounded suffix.
	const scanLimit = 64;
	const rows = await database.execute<AcceptedTagPathCandidate>(sql`
		with candidate_path as materialized (
			select member.path_id as "pathId"
			from ${tagPathMember} member
			where member.node_id = ${input.tagId}::uuid
				and member.path_id > ${input.cursor ?? "00000000-0000-0000-0000-000000000000"}::uuid
			order by member.path_id
			limit ${scanLimit + 1}
		)
		select
			candidate."pathId" as "pathId",
			stat.score as score,
			stat.vote_count as "voteCount",
			stat.usage_count as "usageCount"
		from candidate_path candidate
		join ${tagPathVoteStat} stat on stat.path_id = candidate."pathId"
		order by candidate."pathId"
	`);
	const { pageRows, nextCursor } = paginateAcceptedTagPathCandidates({
		candidates: rows.rows,
		itemLimit: input.limit,
		scanLimit,
	});
	const members = await listPathMembers(
		pageRows.map((row) => row.pathId),
		input.localizationLanguages,
	);
	return {
		items: pageRows.map((row) => ({
			pathId: row.pathId,
			score: toSafeInteger(row.score, "Tag Path score"),
			voteCount: toSafeInteger(row.voteCount, "Tag Path vote count"),
			usageCount: toSafeInteger(row.usageCount, "Tag Path usage count"),
			members: members.get(row.pathId) ?? [],
		})),
		nextCursor,
	};
}

type TagSuggestionMatch = {
	readonly kind: "exact" | "prefix" | "token" | "fuzzy";
	readonly source: "direct_tag" | "expression_component" | "path_member";
	readonly tagId: string;
};

type DirectTagExpressionSuggestion = {
	readonly selection: "direct_expression";
	readonly selectionKey: `expression:${string}`;
	readonly expression: TagExpressionDefinition;
	readonly senseId: null;
	readonly pathId: null;
	readonly members: TagPathMember[];
	readonly usageCount: number;
	readonly match: TagSuggestionMatch;
};

type PathSenseTagExpressionSuggestion = {
	readonly selection: "path_sense";
	readonly selectionKey: `sense:${string}`;
	readonly expression: TagExpressionDefinition;
	readonly senseId: string;
	readonly pathId: string;
	readonly members: TagPathMember[];
	readonly usageCount: number;
	readonly match: TagSuggestionMatch;
};

export type TagExpressionSuggestion =
	| DirectTagExpressionSuggestion
	| PathSenseTagExpressionSuggestion;

type TagSuggestionCandidate = {
	readonly tagId: string;
	readonly searchScore: number;
	readonly candidateRank: number;
};

type TagSuggestionTerm = {
	readonly tagId: string;
	readonly value: string;
};

type TagSuggestionRow = {
	readonly expressionId: string;
	readonly expressionKind: string;
	readonly senseId: string | null;
	readonly pathId: string | null;
	readonly usageCount: bigint | null;
	readonly matchedTagId: string;
	readonly matchedSource: "direct_tag" | "expression_component" | "path_member";
	readonly candidateRank: number;
};

type RankedTagExpressionSuggestion = {
	readonly item: TagExpressionSuggestion;
	readonly candidateRank: number;
};

function normalizeSuggestionText(value: string): string {
	return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
}

function classifySuggestionMatch(query: string, title: string | null | undefined) {
	const normalizedTitle = title ? normalizeSuggestionText(title) : "";
	if (normalizedTitle === query) return "exact" as const;
	if (normalizedTitle.startsWith(query)) return "prefix" as const;
	if (
		normalizedTitle
			.split(/[\s\p{P}\p{S}]+/u)
			.filter(Boolean)
			.some((token) => token.startsWith(query))
	)
		return "token" as const;
	return "fuzzy" as const;
}

const SuggestionMatchOrder = { exact: 0, prefix: 1, token: 2, fuzzy: 3 } as const;

function classifySuggestionTerms(
	query: string,
	terms: readonly (string | null | undefined)[],
): keyof typeof SuggestionMatchOrder {
	let best: keyof typeof SuggestionMatchOrder = "fuzzy";
	for (const term of terms) {
		const match = classifySuggestionMatch(query, term);
		if (SuggestionMatchOrder[match] < SuggestionMatchOrder[best]) best = match;
		if (best === "exact") break;
	}
	return best;
}

function sortRankedSuggestions(
	left: RankedTagExpressionSuggestion,
	right: RankedTagExpressionSuggestion,
): number {
	return (
		SuggestionMatchOrder[left.item.match.kind] - SuggestionMatchOrder[right.item.match.kind] ||
		left.candidateRank - right.candidateRank ||
		right.item.usageCount - left.item.usageCount ||
		left.item.selectionKey.localeCompare(right.item.selectionKey)
	);
}

function mixSuggestionPools(
	direct: readonly RankedTagExpressionSuggestion[],
	paths: readonly RankedTagExpressionSuggestion[],
	limit: number,
): TagExpressionSuggestion[] {
	if (!direct.length) return paths.slice(0, limit).map(({ item }) => item);
	if (!paths.length) return direct.slice(0, limit).map(({ item }) => item);
	const directTarget = Math.ceil(limit * 0.6);
	const selectedDirect = direct.slice(0, directTarget);
	const selectedPaths = paths.slice(0, limit - selectedDirect.length);
	const remaining = limit - selectedDirect.length - selectedPaths.length;
	const overflow = [
		...direct.slice(selectedDirect.length),
		...paths.slice(selectedPaths.length),
	].sort(sortRankedSuggestions);
	return [...selectedDirect, ...selectedPaths, ...overflow.slice(0, remaining)].map(
		({ item }) => item,
	);
}

/** Picker search returns explicit semantic choices; it never silently chooses among structural Paths. */
export async function suggestTagExpressions(input: {
	readonly query: string;
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly realmId?: string;
	readonly limit: number;
	/** Internal pool restriction used by curation surfaces that cannot consume mixed results. */
	readonly selection?: "direct_expression" | "path_sense";
}): Promise<TagExpressionSuggestion[]> {
	const candidateLimit = Math.min(Math.max(input.limit * 4, 40), 80);
	const candidates = await database.execute<TagSuggestionCandidate>(sql`
		select candidate.tag_id as "tagId",
			candidate.search_score as "searchScore",
			candidate.candidate_rank as "candidateRank"
		from public.search_tag_suggestion_candidates(
			${input.query},
			${toTextArray(input.localizationLanguages ?? [])},
			5000,
			${candidateLimit}
		) candidate
		order by candidate.candidate_rank
	`);
	const tagIds = candidates.rows.map((row) => row.tagId);
	if (!tagIds.length) return [];
	const query = normalizeSuggestionText(input.query);
	const suggestionTerms = await database.execute<TagSuggestionTerm>(sql`
		with candidate(tag_id) as materialized (
			select value
			from unnest(${toUuidArray(tagIds)}) as ranked(value)
		)
		(
			select candidate.tag_id as "tagId", localization.title as value
			from candidate
			join ${unitLocalization} localization on localization.unit_id = candidate.tag_id
			where localization.title is not null
			limit ${candidateLimit * 7}
		)
		union all
		(
			select candidate.tag_id as "tagId", unit_alias.term as value
			from candidate
			join ${unitAlias} unit_alias on unit_alias.unit_id = candidate.tag_id
			where unit_alias.withdrawn_at is null
				and unit_alias.normalized_term = ${query}
			limit ${candidateLimit * 8}
		)
	`);
	const termsByTagId = new Map<string, string[]>();
	for (const term of suggestionTerms.rows) {
		const existing = termsByTagId.get(term.tagId);
		if (existing) existing.push(term.value);
		else termsByTagId.set(term.tagId, [term.value]);
	}
	const poolLimit = Math.min(Math.max(input.limit * 4, 16), 80);
	const directRows =
		input.selection === "path_sense"
			? []
			: (
					await database.execute<TagSuggestionRow>(sql`
						with candidate(tag_id, candidate_rank) as materialized (
							select value, ordinality::integer
							from unnest(${toUuidArray(tagIds)}) with ordinality as ranked(value, ordinality)
						)
						select matched_expression.id as "expressionId",
							matched_expression.expression_kind as "expressionKind",
							null::uuid as "senseId",
							null::uuid as "pathId",
							0::bigint as "usageCount",
							candidate.tag_id as "matchedTagId",
							'direct_tag'::text as "matchedSource",
							candidate.candidate_rank as "candidateRank"
						from candidate
						cross join lateral (
							select expression.id, expression.expression_kind
							from ${tagExpression} expression
							where expression.focus_tag_id = candidate.tag_id
								and expression.expression_kind = 'simple'
								and expression.status = 'active'
								and expression.sealed_at is not null
							order by expression.id
							limit ${poolLimit}
						) matched_expression
						order by candidate.candidate_rank, matched_expression.id
						limit ${poolLimit}
					`)
				).rows;
	const pathRows =
		input.selection === "direct_expression"
			? []
			: (
					await database.execute<TagSuggestionRow>(sql`
						with candidate(tag_id, candidate_rank) as materialized (
							select value, ordinality::integer
							from unnest(${toUuidArray(tagIds)}) with ordinality as ranked(value, ordinality)
						), expression_raw_hit as materialized (
							(
								select matched_expression.id as expression_id,
									candidate.tag_id,
									candidate.candidate_rank
								from candidate
								cross join lateral (
									select expression.id
									from ${tagExpression} expression
									where expression.focus_tag_id = candidate.tag_id
										and expression.status = 'active'
										and expression.sealed_at is not null
									order by expression.id
									limit ${poolLimit}
								) matched_expression
								order by candidate.candidate_rank, matched_expression.id
								limit ${poolLimit}
							)
							union all
							(
								select matched_argument.expression_id,
									candidate.tag_id,
									candidate.candidate_rank
								from candidate
								cross join lateral (
									select argument.expression_id
									from ${tagExpressionArgument} argument
									join ${tagExpression} expression on expression.id = argument.expression_id
									where argument.tag_id = candidate.tag_id
										and expression.status = 'active'
										and expression.sealed_at is not null
									order by argument.expression_id
									limit ${poolLimit}
								) matched_argument
								order by candidate.candidate_rank, matched_argument.expression_id
								limit ${poolLimit}
							)
						), expression_hit as materialized (
							select distinct on (hit.expression_id)
								hit.expression_id, hit.tag_id, hit.candidate_rank
							from expression_raw_hit hit
							order by hit.expression_id, hit.candidate_rank, hit.tag_id
						), path_raw_hit as materialized (
							select matched_path.path_id, candidate.tag_id, candidate.candidate_rank
							from candidate
							cross join lateral (
								select member.path_id
								from ${tagPathMember} member
								where member.node_id = candidate.tag_id
								order by member.path_id
								limit ${poolLimit * 2}
							) matched_path
							order by candidate.candidate_rank, matched_path.path_id
							limit ${poolLimit * 2}
						), path_hit as materialized (
							select distinct on (hit.path_id)
								hit.path_id, hit.tag_id, hit.candidate_rank
							from path_raw_hit hit
							order by hit.path_id, hit.candidate_rank, hit.tag_id
						), sense_raw_hit as materialized (
							(
								select matched_sense.id as sense_id,
									expression_hit.tag_id,
									expression_hit.candidate_rank,
									0::integer as source_order
								from expression_hit
								cross join lateral (
									select sense.id
									from ${tagPathSense} sense
									where sense.expression_id = expression_hit.expression_id
										and sense.status = 'active'
										and sense.sealed_at is not null
										and (
											sense.scope = 'global'
											${
												input.realmId
													? sql`or (sense.scope = 'realm' and sense.realm_id = ${input.realmId}::uuid)`
													: sql``
											}
										)
									order by sense.id
									limit ${poolLimit}
								) matched_sense
								order by expression_hit.candidate_rank, matched_sense.id
								limit ${poolLimit * 2}
							)
							union all
							(
								select matched_sense.id as sense_id,
									path_hit.tag_id,
									path_hit.candidate_rank,
									1::integer as source_order
								from path_hit
								cross join lateral (
									select sense.id
									from ${tagPathSense} sense
									where sense.path_id = path_hit.path_id
										and sense.status = 'active'
										and sense.sealed_at is not null
										and (
											sense.scope = 'global'
											${
												input.realmId
													? sql`or (sense.scope = 'realm' and sense.realm_id = ${input.realmId}::uuid)`
													: sql``
											}
										)
									order by sense.id
									limit ${poolLimit}
								) matched_sense
								order by path_hit.candidate_rank, matched_sense.id
								limit ${poolLimit * 2}
							)
						), sense_hit as materialized (
							select distinct on (hit.sense_id)
								hit.sense_id, hit.tag_id, hit.candidate_rank, hit.source_order
							from sense_raw_hit hit
							order by hit.sense_id, hit.candidate_rank, hit.source_order, hit.tag_id
						)
						select expression.id as "expressionId",
							expression.expression_kind as "expressionKind",
							sense.id as "senseId",
							sense.path_id as "pathId",
							coalesce(stat.usage_count, 0) as "usageCount",
							sense_hit.tag_id as "matchedTagId",
							case when sense_hit.source_order = 0
								then 'expression_component'
								else 'path_member'
							end as "matchedSource",
							sense_hit.candidate_rank as "candidateRank"
						from sense_hit
						join ${tagPathSense} sense on sense.id = sense_hit.sense_id
						join ${tagExpression} expression on expression.id = sense.expression_id
						left join ${tagPathVoteStat} stat on stat.path_id = sense.path_id
						${
							input.realmId
								? sql`join ${realmTagPathSense} adoption
									on adoption.sense_id = sense.id
									and adoption.realm_id = ${input.realmId}::uuid`
								: sql``
						}
						where expression.status = 'active'
							and expression.sealed_at is not null
						order by sense_hit.candidate_rank, coalesce(stat.usage_count, 0) desc, sense.id
						limit ${poolLimit}
					`)
				).rows;
	const expressionRows = [...directRows, ...pathRows];
	const expressionIds = [...new Set(expressionRows.map((row) => row.expressionId))];
	const definitions = await listExpressionDefinitions(expressionIds, input.localizationLanguages);
	const pathIds = expressionRows.flatMap((row) => (row.pathId ? [row.pathId] : []));
	const members = await listPathMembers(pathIds, input.localizationLanguages);
	const direct: RankedTagExpressionSuggestion[] = [];
	const paths: RankedTagExpressionSuggestion[] = [];
	for (const row of expressionRows) {
		const definition = definitions.get(row.expressionId);
		if (!definition) continue;
		const pathMembers = row.pathId ? (members.get(row.pathId) ?? []) : [];
		const matchedTitle =
			row.matchedSource === "path_member"
				? pathMembers.find((member) => member.nodeId === row.matchedTagId)?.title
				: definition.components.find((component) => component.tagId === row.matchedTagId)?.title;
		const match = {
			kind: classifySuggestionTerms(query, [
				matchedTitle,
				...(termsByTagId.get(row.matchedTagId) ?? []),
			]),
			source: row.matchedSource,
			tagId: row.matchedTagId,
		} as const;
		if (row.senseId && row.pathId) {
			const selectionKey = `sense:${row.senseId}` as const;
			paths.push({
				candidateRank: row.candidateRank,
				item: {
					selection: "path_sense",
					selectionKey,
					expression: definition,
					senseId: row.senseId,
					pathId: row.pathId,
					members: pathMembers,
					usageCount: toSafeInteger(row.usageCount ?? 0n, "Tag Path usage count"),
					match,
				},
			});
		} else if (row.expressionKind === "simple") {
			const selectionKey = `expression:${row.expressionId}` as const;
			direct.push({
				candidateRank: row.candidateRank,
				item: {
					selection: "direct_expression",
					selectionKey,
					expression: definition,
					senseId: null,
					pathId: null,
					members: [],
					usageCount: 0,
					match,
				},
			});
		}
	}
	direct.sort(sortRankedSuggestions);
	paths.sort(sortRankedSuggestions);
	if (input.selection === "direct_expression")
		return direct.slice(0, input.limit).map(({ item }) => item);
	if (input.selection === "path_sense") return paths.slice(0, input.limit).map(({ item }) => item);
	return mixSuggestionPools(direct, paths, input.limit);
}

export async function searchTagPathsForCuration(
	input: Parameters<typeof suggestTagExpressions>[0],
) {
	return await suggestTagExpressions({ ...input, selection: "path_sense" });
}

async function ensureGlobalSense(tx: DatabaseTransaction, senseId: string) {
	const [sense] = await tx
		.select({ id: tagPathSense.id, pathId: tagPathSense.pathId })
		.from(tagPathSense)
		.where(
			and(
				eq(tagPathSense.id, senseId),
				eq(tagPathSense.scope, "global"),
				eq(tagPathSense.status, "active"),
				isNotNull(tagPathSense.sealedAt),
			),
		)
		.limit(1);
	if (!sense) throw new TagPathNotFound();
	return sense;
}

export async function applyTagPath(input: {
	readonly unitId: string;
	readonly senseId: string;
	readonly profileId: string;
	readonly fitVote?: BinaryVote;
	readonly spoilerLevel?: SpoilerLevel | null;
	readonly createdAt?: Date;
}) {
	return runVoteTransaction({ family: "tag_path", authority: "global" }, async (tx) => {
		await ensureGlobalSense(tx, input.senseId);
		const createdAt = input.createdAt ?? new Date();
		const [created] = await tx
			.insert(unitTagPathApplication)
			.values({
				unitId: input.unitId,
				senseId: input.senseId,
				createdByProfileId: input.profileId,
				createdAt,
				updatedAt: createdAt,
			})
			.onConflictDoNothing()
			.returning({ id: unitTagPathApplication.id });
		const [application] = created
			? [created]
			: await tx
					.select({ id: unitTagPathApplication.id })
					.from(unitTagPathApplication)
					.where(
						and(
							eq(unitTagPathApplication.unitId, input.unitId),
							eq(unitTagPathApplication.senseId, input.senseId),
						),
					)
					.limit(1);
		if (!application) throw new TagPathApplicationNotFound();
		await upsertApplicationJudgment(tx, {
			applicationId: application.id,
			profileId: input.profileId,
			fitVote: input.fitVote ?? 1,
			spoilerLevel: input.spoilerLevel,
			createdAt,
		});
		return { applicationId: application.id, senseId: input.senseId, created: Boolean(created) };
	});
}

async function upsertApplicationJudgment(
	tx: DatabaseTransaction,
	input: {
		readonly applicationId: string;
		readonly profileId: string;
		readonly fitVote?: BinaryVote | null;
		readonly spoilerLevel?: SpoilerLevel | null;
		readonly createdAt?: Date;
	},
): Promise<void> {
	const now = input.createdAt ?? new Date();
	const fitProvided = input.fitVote !== undefined;
	const spoilerProvided = input.spoilerLevel !== undefined;
	if (!fitProvided && !spoilerProvided) return;
	await tx
		.insert(unitTagPathApplicationJudgment)
		.values({
			applicationId: input.applicationId,
			profileId: input.profileId,
			fitVote: input.fitVote,
			spoilerLevel: input.spoilerLevel,
			fitUpdatedAt: fitProvided && input.fitVote !== null ? now : null,
			spoilerUpdatedAt: spoilerProvided && input.spoilerLevel !== null ? now : null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				unitTagPathApplicationJudgment.applicationId,
				unitTagPathApplicationJudgment.profileId,
			],
			set: {
				...(fitProvided
					? { fitVote: input.fitVote, fitUpdatedAt: input.fitVote === null ? null : now }
					: {}),
				...(spoilerProvided
					? {
							spoilerLevel: input.spoilerLevel,
							spoilerUpdatedAt: input.spoilerLevel === null ? null : now,
						}
					: {}),
				updatedAt: now,
			},
		});
	await tx.execute(sql`
		delete from ${unitTagPathApplicationJudgment}
		where application_id = ${input.applicationId}
			and profile_id = ${input.profileId}
			and fit_vote is null and spoiler_level is null
	`);
}

export async function removeTagPathApplication(input: {
	readonly applicationId: string;
	readonly unitId: string;
}) {
	const deleted = await database
		.delete(unitTagPathApplication)
		.where(
			and(
				eq(unitTagPathApplication.id, input.applicationId),
				eq(unitTagPathApplication.unitId, input.unitId),
			),
		)
		.returning({ id: unitTagPathApplication.id });
	if (!deleted.length) throw new TagPathApplicationNotFound();
	return { applicationId: input.applicationId, applied: false as const };
}

export async function judgeTagPathApplication(input: {
	readonly applicationId: string;
	readonly unitId: string;
	readonly profileId: string;
	readonly fitVote?: BinaryVote | null;
	readonly spoilerLevel?: SpoilerLevel | null;
}) {
	await runVoteTransaction({ family: "tag_path", authority: "global" }, async (tx) => {
		const [application] = await tx
			.select({ id: unitTagPathApplication.id })
			.from(unitTagPathApplication)
			.where(
				and(
					eq(unitTagPathApplication.id, input.applicationId),
					eq(unitTagPathApplication.unitId, input.unitId),
				),
			)
			.limit(1);
		if (!application) throw new TagPathApplicationNotFound();
		await upsertApplicationJudgment(tx, input);
	});
	return getApplicationJudgmentSummary(input.applicationId, input.profileId);
}

export async function clearTagPathApplicationJudgment(input: {
	readonly applicationId: string;
	readonly unitId: string;
	readonly profileId: string;
}) {
	const [application] = await database
		.select({ id: unitTagPathApplication.id })
		.from(unitTagPathApplication)
		.where(
			and(
				eq(unitTagPathApplication.id, input.applicationId),
				eq(unitTagPathApplication.unitId, input.unitId),
			),
		)
		.limit(1);
	if (!application) throw new TagPathApplicationNotFound();
	await database
		.delete(unitTagPathApplicationJudgment)
		.where(
			and(
				eq(unitTagPathApplicationJudgment.applicationId, input.applicationId),
				eq(unitTagPathApplicationJudgment.profileId, input.profileId),
			),
		);
	return getApplicationJudgmentSummary(input.applicationId, null);
}

async function getApplicationJudgmentSummary(applicationId: string, profileId: string | null) {
	const viewer = alias(unitTagPathApplicationJudgment, "summary_viewer_application_judgment");
	const [row] = await database
		.select({
			score: unitTagPathApplicationJudgmentStat.score,
			voteCount: unitTagPathApplicationJudgmentStat.voteCount,
			spoilerVoteCount: unitTagPathApplicationJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: unitTagPathApplicationJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: unitTagPathApplicationJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: unitTagPathApplicationJudgmentStat.spoilerMajorCount,
			viewerVote: viewer.fitVote,
			viewerSpoilerLevel: viewer.spoilerLevel,
		})
		.from(unitTagPathApplication)
		.leftJoin(
			unitTagPathApplicationJudgmentStat,
			eq(unitTagPathApplicationJudgmentStat.applicationId, unitTagPathApplication.id),
		)
		.leftJoin(
			viewer,
			and(
				eq(viewer.applicationId, unitTagPathApplication.id),
				profileId ? eq(viewer.profileId, profileId) : sql`false`,
			),
		)
		.where(eq(unitTagPathApplication.id, applicationId))
		.limit(1);
	if (!row) throw new TagPathApplicationNotFound();
	return {
		score: toSafeInteger(row.score ?? 0n, "Tag Path application score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Tag Path application vote count"),
		spoilerVoteCount: toSafeInteger(row.spoilerVoteCount ?? 0n, "spoiler vote count"),
		spoilerDistribution: {
			none: toSafeInteger(row.spoilerNoneCount ?? 0n, "none spoiler vote count"),
			minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "minor spoiler vote count"),
			major: toSafeInteger(row.spoilerMajorCount ?? 0n, "major spoiler vote count"),
		},
		viewerVote: presentVote(row.viewerVote),
		viewerSpoilerLevel: presentSpoilerLevel(row.viewerSpoilerLevel),
	};
}

export type VisibleExpressionApplication = {
	readonly applicationId: string | null;
	readonly sourceKind: "direct" | "path";
	readonly authority:
		| { readonly kind: "global" }
		| { readonly kind: "realm"; readonly realmId: string };
	readonly senseId: string | null;
	readonly pathId: string | null;
	readonly tagId: string | null;
	readonly expressionId: string;
	readonly createdByProfileId: string | null;
	readonly members: TagPathMember[];
	readonly score: number;
	readonly voteCount: number;
	readonly spoilerVoteCount: number;
	readonly spoilerDistribution: Readonly<{
		none: number;
		minor: number;
		major: number;
	}>;
	readonly viewerVote: OptionalBinaryVote;
	readonly viewerSpoilerLevel: SpoilerLevel | null;
	readonly createdAt: Date;
};

/** Bounded source read used by Unit pages. Aggregation happens by (authority, Expression). */
export async function listVisibleUnitTagExpressions(input: {
	readonly unitId: string;
	readonly viewerProfileId?: string;
	readonly realmIds?: readonly string[];
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const directGlobalRows = await database
		.select({
			tagId: unitTag.tagId,
			expressionId: tagExpression.id,
			createdByProfileId: unitTag.createdByProfileId,
			score: unitTagJudgmentStat.score,
			voteCount: unitTagJudgmentStat.voteCount,
			spoilerVoteCount: unitTagJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: unitTagJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: unitTagJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: unitTagJudgmentStat.spoilerMajorCount,
			viewerVote: viewerDirectTagJudgment.fitVote,
			viewerSpoilerLevel: viewerDirectTagJudgment.spoilerLevel,
			createdAt: unitTag.createdAt,
		})
		.from(unitTag)
		.innerJoin(
			tagExpression,
			and(
				eq(tagExpression.focusTagId, unitTag.tagId),
				eq(tagExpression.expressionKind, "simple"),
				isNotNull(tagExpression.sealedAt),
			),
		)
		.leftJoin(
			unitTagJudgmentStat,
			and(
				eq(unitTagJudgmentStat.unitId, unitTag.unitId),
				eq(unitTagJudgmentStat.tagId, unitTag.tagId),
			),
		)
		.leftJoin(
			viewerDirectTagJudgment,
			and(
				eq(viewerDirectTagJudgment.unitId, unitTag.unitId),
				eq(viewerDirectTagJudgment.tagId, unitTag.tagId),
				input.viewerProfileId
					? eq(viewerDirectTagJudgment.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(eq(unitTag.unitId, input.unitId))
		.orderBy(desc(unitTag.pinned), unitTag.position, unitTag.tagId)
		.limit(input.limit);
	const globalRows = await database
		.select({
			applicationId: unitTagPathApplication.id,
			createdByProfileId: unitTagPathApplication.createdByProfileId,
			senseId: unitTagPathApplication.senseId,
			pathId: tagPathSense.pathId,
			expressionId: tagPathSense.expressionId,
			score: unitTagPathApplicationJudgmentStat.score,
			voteCount: unitTagPathApplicationJudgmentStat.voteCount,
			spoilerVoteCount: unitTagPathApplicationJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: unitTagPathApplicationJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: unitTagPathApplicationJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: unitTagPathApplicationJudgmentStat.spoilerMajorCount,
			viewerVote: viewerApplicationJudgment.fitVote,
			viewerSpoilerLevel: viewerApplicationJudgment.spoilerLevel,
			createdAt: unitTagPathApplication.createdAt,
		})
		.from(unitTagPathApplication)
		.innerJoin(tagPathSense, eq(tagPathSense.id, unitTagPathApplication.senseId))
		.leftJoin(
			unitTagPathApplicationJudgmentStat,
			eq(unitTagPathApplicationJudgmentStat.applicationId, unitTagPathApplication.id),
		)
		.leftJoin(
			viewerApplicationJudgment,
			and(
				eq(viewerApplicationJudgment.applicationId, unitTagPathApplication.id),
				input.viewerProfileId
					? eq(viewerApplicationJudgment.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(and(eq(unitTagPathApplication.unitId, input.unitId), isNotNull(tagPathSense.sealedAt)))
		.orderBy(desc(unitTagPathApplication.createdAt), unitTagPathApplication.id)
		.limit(input.limit);
	const realmRows = input.realmIds?.length
		? await database
				.select({
					applicationId: realmUnitTagPathApplication.id,
					createdByProfileId: realmUnitTagPathApplication.createdByProfileId,
					realmId: realmUnitTagPathApplication.realmId,
					senseId: realmUnitTagPathApplication.senseId,
					pathId: tagPathSense.pathId,
					expressionId: tagPathSense.expressionId,
					score: realmUnitTagPathApplicationJudgmentStat.score,
					voteCount: realmUnitTagPathApplicationJudgmentStat.voteCount,
					spoilerVoteCount: realmUnitTagPathApplicationJudgmentStat.spoilerVoteCount,
					spoilerNoneCount: realmUnitTagPathApplicationJudgmentStat.spoilerNoneCount,
					spoilerMinorCount: realmUnitTagPathApplicationJudgmentStat.spoilerMinorCount,
					spoilerMajorCount: realmUnitTagPathApplicationJudgmentStat.spoilerMajorCount,
					viewerVote: viewerRealmApplicationJudgment.fitVote,
					viewerSpoilerLevel: viewerRealmApplicationJudgment.spoilerLevel,
					createdAt: realmUnitTagPathApplication.createdAt,
				})
				.from(realmUnitTagPathApplication)
				.innerJoin(tagPathSense, eq(tagPathSense.id, realmUnitTagPathApplication.senseId))
				.leftJoin(
					realmUnitTagPathApplicationJudgmentStat,
					eq(realmUnitTagPathApplicationJudgmentStat.applicationId, realmUnitTagPathApplication.id),
				)
				.leftJoin(
					viewerRealmApplicationJudgment,
					and(
						eq(viewerRealmApplicationJudgment.applicationId, realmUnitTagPathApplication.id),
						input.viewerProfileId
							? eq(viewerRealmApplicationJudgment.profileId, input.viewerProfileId)
							: sql`false`,
					),
				)
				.where(
					and(
						eq(realmUnitTagPathApplication.unitId, input.unitId),
						inArray(realmUnitTagPathApplication.realmId, [...input.realmIds]),
						isNotNull(tagPathSense.sealedAt),
					),
				)
				.orderBy(
					realmUnitTagPathApplication.realmId,
					desc(realmUnitTagPathApplication.createdAt),
					realmUnitTagPathApplication.id,
				)
				.limit(input.limit)
		: [];
	const directRealmRows = input.realmIds?.length
		? await database
				.select({
					realmId: realmUnitTag.realmId,
					tagId: realmUnitTag.tagId,
					expressionId: tagExpression.id,
					createdByProfileId: realmUnitTag.createdByProfileId,
					score: realmTagJudgmentStat.score,
					voteCount: realmTagJudgmentStat.voteCount,
					spoilerVoteCount: realmTagJudgmentStat.spoilerVoteCount,
					spoilerNoneCount: realmTagJudgmentStat.spoilerNoneCount,
					spoilerMinorCount: realmTagJudgmentStat.spoilerMinorCount,
					spoilerMajorCount: realmTagJudgmentStat.spoilerMajorCount,
					viewerVote: viewerRealmDirectTagJudgment.fitVote,
					viewerSpoilerLevel: viewerRealmDirectTagJudgment.spoilerLevel,
					createdAt: realmUnitTag.createdAt,
				})
				.from(realmUnitTag)
				.innerJoin(
					tagExpression,
					and(
						eq(tagExpression.focusTagId, realmUnitTag.tagId),
						eq(tagExpression.expressionKind, "simple"),
						isNotNull(tagExpression.sealedAt),
					),
				)
				.leftJoin(
					realmTagJudgmentStat,
					and(
						eq(realmTagJudgmentStat.realmId, realmUnitTag.realmId),
						eq(realmTagJudgmentStat.unitId, realmUnitTag.unitId),
						eq(realmTagJudgmentStat.tagId, realmUnitTag.tagId),
					),
				)
				.leftJoin(
					viewerRealmDirectTagJudgment,
					and(
						eq(viewerRealmDirectTagJudgment.realmId, realmUnitTag.realmId),
						eq(viewerRealmDirectTagJudgment.unitId, realmUnitTag.unitId),
						eq(viewerRealmDirectTagJudgment.tagId, realmUnitTag.tagId),
						input.viewerProfileId
							? eq(viewerRealmDirectTagJudgment.profileId, input.viewerProfileId)
							: sql`false`,
					),
				)
				.where(
					and(
						eq(realmUnitTag.unitId, input.unitId),
						inArray(realmUnitTag.realmId, [...input.realmIds]),
					),
				)
				.orderBy(realmUnitTag.realmId, realmUnitTag.position, realmUnitTag.tagId)
				.limit(input.limit)
		: [];
	const pathIds = [...new Set([...globalRows, ...realmRows].map((row) => row.pathId))];
	const expressionIds = [
		...new Set(
			[...directGlobalRows, ...globalRows, ...directRealmRows, ...realmRows].map(
				(row) => row.expressionId,
			),
		),
	];
	const [members, definitions] = await Promise.all([
		listPathMembers(pathIds, input.localizationLanguages),
		listExpressionDefinitions(expressionIds, input.localizationLanguages),
	]);
	const applications: VisibleExpressionApplication[] = [
		...directGlobalRows.map((row) => ({
			applicationId: null,
			sourceKind: "direct" as const,
			authority: { kind: "global" as const },
			senseId: null,
			pathId: null,
			tagId: row.tagId,
			expressionId: row.expressionId,
			createdByProfileId: row.createdByProfileId,
			members: [],
			score: toSafeInteger(row.score ?? 0n, "direct Tag score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "direct Tag vote count"),
			spoilerVoteCount: toSafeInteger(row.spoilerVoteCount ?? 0n, "direct Tag spoiler vote count"),
			spoilerDistribution: {
				none: toSafeInteger(row.spoilerNoneCount ?? 0n, "direct Tag none spoiler count"),
				minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "direct Tag minor spoiler count"),
				major: toSafeInteger(row.spoilerMajorCount ?? 0n, "direct Tag major spoiler count"),
			},
			viewerVote: presentVote(row.viewerVote),
			viewerSpoilerLevel: presentSpoilerLevel(row.viewerSpoilerLevel),
			createdAt: row.createdAt,
		})),
		...globalRows.map((row) => ({
			applicationId: row.applicationId,
			sourceKind: "path" as const,
			authority: { kind: "global" as const },
			senseId: row.senseId,
			pathId: row.pathId,
			tagId: null,
			expressionId: row.expressionId,
			createdByProfileId: row.createdByProfileId,
			members: members.get(row.pathId) ?? [],
			score: toSafeInteger(row.score ?? 0n, "application score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "application vote count"),
			spoilerVoteCount: toSafeInteger(row.spoilerVoteCount ?? 0n, "application spoiler count"),
			spoilerDistribution: {
				none: toSafeInteger(row.spoilerNoneCount ?? 0n, "application none spoiler count"),
				minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "application minor spoiler count"),
				major: toSafeInteger(row.spoilerMajorCount ?? 0n, "application major spoiler count"),
			},
			viewerVote: presentVote(row.viewerVote),
			viewerSpoilerLevel: presentSpoilerLevel(row.viewerSpoilerLevel),
			createdAt: row.createdAt,
		})),
		...realmRows.map((row) => ({
			applicationId: row.applicationId,
			sourceKind: "path" as const,
			authority: { kind: "realm" as const, realmId: row.realmId },
			senseId: row.senseId,
			pathId: row.pathId,
			tagId: null,
			expressionId: row.expressionId,
			createdByProfileId: row.createdByProfileId,
			members: members.get(row.pathId) ?? [],
			score: toSafeInteger(row.score ?? 0n, "Realm application score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "Realm application vote count"),
			spoilerVoteCount: toSafeInteger(
				row.spoilerVoteCount ?? 0n,
				"Realm application spoiler count",
			),
			spoilerDistribution: {
				none: toSafeInteger(row.spoilerNoneCount ?? 0n, "Realm application none spoiler count"),
				minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "Realm application minor spoiler count"),
				major: toSafeInteger(row.spoilerMajorCount ?? 0n, "Realm application major spoiler count"),
			},
			viewerVote: presentVote(row.viewerVote),
			viewerSpoilerLevel: presentSpoilerLevel(row.viewerSpoilerLevel),
			createdAt: row.createdAt,
		})),
		...directRealmRows.map((row) => ({
			applicationId: null,
			sourceKind: "direct" as const,
			authority: { kind: "realm" as const, realmId: row.realmId },
			senseId: null,
			pathId: null,
			tagId: row.tagId,
			expressionId: row.expressionId,
			createdByProfileId: row.createdByProfileId,
			members: [],
			score: toSafeInteger(row.score ?? 0n, "Realm direct Tag score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "Realm direct Tag vote count"),
			spoilerVoteCount: toSafeInteger(row.spoilerVoteCount ?? 0n, "Realm direct Tag spoiler count"),
			spoilerDistribution: {
				none: toSafeInteger(row.spoilerNoneCount ?? 0n, "Realm direct Tag none spoiler count"),
				minor: toSafeInteger(row.spoilerMinorCount ?? 0n, "Realm direct Tag minor spoiler count"),
				major: toSafeInteger(row.spoilerMajorCount ?? 0n, "Realm direct Tag major spoiler count"),
			},
			viewerVote: presentVote(row.viewerVote),
			viewerSpoilerLevel: presentSpoilerLevel(row.viewerSpoilerLevel),
			createdAt: row.createdAt,
		})),
	];
	const groups = new Map<
		string,
		{
			readonly authority: VisibleExpressionApplication["authority"];
			readonly expression: TagExpressionDefinition;
			readonly applications: VisibleExpressionApplication[];
		}
	>();
	for (const application of applications) {
		const definition = definitions.get(application.expressionId);
		if (!definition) continue;
		const authorityKey =
			application.authority.kind === "global" ? "global" : `realm:${application.authority.realmId}`;
		const key = `${authorityKey}:${application.expressionId}`;
		const existing = groups.get(key);
		if (existing) existing.applications.push(application);
		else
			groups.set(key, {
				authority: application.authority,
				expression: definition,
				applications: [application],
			});
	}
	return [...groups.values()];
}

export interface ProposeTagPathMergeInput {
	readonly sourcePathId: string;
	readonly targetPathId: string;
	readonly reason: string;
	readonly proposalSourceKind: TagPathMergeProposalSourceKind;
	readonly proposalProvenance?: TagPathAssistanceProvenance;
	readonly profileId: string;
}

export async function proposeTagPathMerge(input: ProposeTagPathMergeInput) {
	if (input.sourcePathId === input.targetPathId || !input.reason.trim())
		throw new InvalidTagPathMerge();
	const [created] = await database
		.insert(tagPathMerge)
		.values({
			sourcePathId: input.sourcePathId,
			targetPathId: input.targetPathId,
			reason: input.reason,
			proposalSourceKind: input.proposalSourceKind,
			proposalProvenance: input.proposalProvenance,
			proposedByProfileId: input.profileId,
		})
		.returning();
	if (!created) throw new InvalidTagPathMerge();
	return created;
}

export async function listPendingTagPathMerges(input: {
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const rows = await database
		.select()
		.from(tagPathMerge)
		.where(eq(tagPathMerge.status, "proposed"))
		.orderBy(tagPathMerge.createdAt, tagPathMerge.id)
		.limit(input.limit);
	const pathIds = rows.flatMap((row) => [row.sourcePathId, row.targetPathId]);
	const members = await listPathMembers(pathIds, input.localizationLanguages);
	return rows.map((row) => ({
		...row,
		sourceMembers: members.get(row.sourcePathId) ?? [],
		targetMembers: members.get(row.targetPathId) ?? [],
	}));
}

export async function resolveTagPathMerge(input: {
	readonly mergeId: string;
	readonly status: "accepted" | "rejected" | "reversed";
	readonly profileId: string;
}) {
	const [updated] = await database
		.update(tagPathMerge)
		.set({
			status: input.status,
			resolvedByProfileId: input.profileId,
			resolvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(tagPathMerge.id, input.mergeId))
		.returning();
	if (!updated) throw new TagPathMergeNotFound();
	return updated;
}

export async function getTagHierarchy(input: {
	readonly tagId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly childLimit: number;
	readonly grandchildLimit: number;
}) {
	const [root] = await database.select({ id: tag.id }).from(tag).where(eq(tag.id, input.tagId));
	if (!root) throw new TagNotFound();
	const relations = await database
		.select({
			relationId: tagRelation.id,
			relationKind: tagRelation.relationKind,
			nodeId: tagRelation.childNodeId,
		})
		.from(tagRelation)
		.where(and(eq(tagRelation.parentNodeId, input.tagId), eq(tagRelation.status, "active")))
		.orderBy(tagRelation.relationKind, tagRelation.childNodeId)
		.limit(input.childLimit);
	const childNodeIds = relations.map((relation) => relation.nodeId);
	const grandchildResult = childNodeIds.length
		? await database.execute<{
				relationId: string;
				relationKind: TagRelationKind;
				parentNodeId: string;
				nodeId: string;
			}>(sql`
				with ranked_relation as (
					select
						relation.id as "relationId",
						relation.relation_kind as "relationKind",
						relation.parent_node_id as "parentNodeId",
						relation.child_node_id as "nodeId",
						row_number() over (
							partition by relation.parent_node_id
							order by relation.relation_kind, relation.child_node_id
						) as sibling_ordinal
					from public.tag_relation relation
					where relation.parent_node_id = any(${toUuidArray(childNodeIds)})
						and relation.status = 'active'
				)
				select "relationId", "relationKind", "parentNodeId", "nodeId"
				from ranked_relation
				where sibling_ordinal <= ${input.grandchildLimit}
				order by "parentNodeId", sibling_ordinal
			`)
		: { rows: [] };
	const nodeIds = [
		...new Set([...childNodeIds, ...grandchildResult.rows.map((relation) => relation.nodeId)]),
	];
	const nodeRows = nodeIds.length
		? await database
				.select({
					nodeId: vocabularyNode.id,
					nodeKind: vocabularyNode.kind,
					language: resolvedUnitLocalizationLanguage(memberUnit.id, input.localizationLanguages),
					tagTitle: resolvedUnitLocalizationTitle(memberUnit.id, input.localizationLanguages),
					guideTitle: guideTitleSql(vocabularyNode.id, input.localizationLanguages),
					summary: resolvedUnitLocalizationSummary(memberUnit.id, input.localizationLanguages),
					avatar: resolvedUnitLocalizationAvatar(memberUnit.id, input.localizationLanguages),
				})
				.from(vocabularyNode)
				.leftJoin(memberUnit, eq(memberUnit.id, vocabularyNode.id))
				.where(inArray(vocabularyNode.id, nodeIds))
		: [];
	const nodes = new Map(
		nodeRows.map(
			(node) =>
				[
					node.nodeId,
					{
						nodeId: node.nodeId,
						nodeKind: node.nodeKind,
						language: node.nodeKind === "concept" ? node.language : null,
						title: node.nodeKind === "concept" ? node.tagTitle : node.guideTitle,
						summary: node.nodeKind === "concept" ? node.summary : null,
						avatar: node.nodeKind === "concept" ? presentAvatar(node.avatar) : null,
					},
				] as const,
		),
	);
	const grandchildrenByParent = new Map<
		string,
		Array<{
			readonly relationId: string;
			readonly relationKind: TagRelationKind;
			readonly node: NonNullable<ReturnType<typeof nodes.get>>;
		}>
	>();
	for (const relation of grandchildResult.rows) {
		const node = nodes.get(relation.nodeId);
		if (!node) continue;
		const children = grandchildrenByParent.get(relation.parentNodeId) ?? [];
		children.push({ relationId: relation.relationId, relationKind: relation.relationKind, node });
		grandchildrenByParent.set(relation.parentNodeId, children);
	}
	return {
		tagId: input.tagId,
		children: relations.flatMap((relation) => {
			const node = nodes.get(relation.nodeId);
			return node
				? [
						{
							relationId: relation.relationId,
							relationKind: relation.relationKind,
							node,
							children: grandchildrenByParent.get(relation.nodeId) ?? [],
						},
					]
				: [];
		}),
	};
}

export async function adoptRealmTagPath(input: {
	readonly realmId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	const [realmRecord, pathRecord] = await Promise.all([
		database.select({ id: realm.id }).from(realm).where(eq(realm.id, input.realmId)).limit(1),
		database.select({ id: tagPath.id }).from(tagPath).where(eq(tagPath.id, input.pathId)).limit(1),
	]);
	if (!realmRecord[0]) throw new RealmNotFound();
	if (!pathRecord[0]) throw new TagPathNotFound();
	await database
		.insert(realmTagPath)
		.values({ realmId: input.realmId, pathId: input.pathId, createdByProfileId: input.profileId })
		.onConflictDoNothing();
	return { realmId: input.realmId, pathId: input.pathId, adopted: true as const };
}

export async function adoptRealmTagPathSense(input: {
	readonly realmId: string;
	readonly senseId: string;
	readonly profileId: string;
}) {
	const [sense] = await database
		.select({
			pathId: tagPathSense.pathId,
			scope: tagPathSense.scope,
			senseRealmId: tagPathSense.realmId,
		})
		.from(tagPathSense)
		.where(
			and(
				eq(tagPathSense.id, input.senseId),
				eq(tagPathSense.status, "active"),
				isNotNull(tagPathSense.sealedAt),
			),
		)
		.limit(1);
	if (!sense || (sense.scope === "realm" && sense.senseRealmId !== input.realmId))
		throw new TagPathNotFound();
	await adoptRealmTagPath({
		realmId: input.realmId,
		pathId: sense.pathId,
		profileId: input.profileId,
	});
	await database
		.insert(realmTagPathSense)
		.values({
			realmId: input.realmId,
			senseId: input.senseId,
			pathId: sense.pathId,
			createdByProfileId: input.profileId,
		})
		.onConflictDoNothing();
	return { realmId: input.realmId, senseId: input.senseId, adopted: true as const };
}

export async function voteRealmTagPath(input: {
	readonly realmId: string;
	readonly pathId: string;
	readonly profileId: string;
	readonly value: BinaryVote;
}) {
	await runVoteTransaction({ family: "tag_path", authority: "realm" }, (tx) =>
		tx
			.insert(realmTagPathVote)
			.values(input)
			.onConflictDoUpdate({
				target: [realmTagPathVote.realmId, realmTagPathVote.pathId, realmTagPathVote.profileId],
				set: { value: input.value, updatedAt: new Date() },
			}),
	);
	return getRealmDefinitionVoteSummary(input.realmId, input.pathId, input.profileId);
}

export async function deleteRealmTagPathVote(input: {
	readonly realmId: string;
	readonly pathId: string;
	readonly profileId: string;
}) {
	await database
		.delete(realmTagPathVote)
		.where(
			and(
				eq(realmTagPathVote.realmId, input.realmId),
				eq(realmTagPathVote.pathId, input.pathId),
				eq(realmTagPathVote.profileId, input.profileId),
			),
		);
	return getRealmDefinitionVoteSummary(input.realmId, input.pathId, null);
}

async function getRealmDefinitionVoteSummary(
	realmId: string,
	pathId: string,
	profileId: string | null,
) {
	const [row] = await database
		.select({
			score: realmTagPathVoteStat.score,
			voteCount: realmTagPathVoteStat.voteCount,
			viewerVote: viewerRealmDefinitionVote.value,
		})
		.from(realmTagPath)
		.leftJoin(
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
				profileId ? eq(viewerRealmDefinitionVote.profileId, profileId) : sql`false`,
			),
		)
		.where(and(eq(realmTagPath.realmId, realmId), eq(realmTagPath.pathId, pathId)))
		.limit(1);
	if (!row) throw new TagPathNotFound();
	return {
		score: toSafeInteger(row.score ?? 0n, "Realm Tag Path score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Realm Tag Path vote count"),
		viewerVote: presentVote(row.viewerVote),
	};
}

export async function applyRealmTagPath(input: {
	readonly realmId: string;
	readonly unitId: string;
	readonly senseId: string;
	readonly profileId: string;
	readonly fitVote?: BinaryVote;
	readonly spoilerLevel?: SpoilerLevel | null;
}) {
	return runVoteTransaction({ family: "tag_path", authority: "realm" }, async (tx) => {
		const [adoption] = await tx
			.select({ senseId: realmTagPathSense.senseId })
			.from(realmTagPathSense)
			.innerJoin(tagPathSense, eq(tagPathSense.id, realmTagPathSense.senseId))
			.where(
				and(
					eq(realmTagPathSense.realmId, input.realmId),
					eq(realmTagPathSense.senseId, input.senseId),
					eq(tagPathSense.status, "active"),
					isNotNull(tagPathSense.sealedAt),
				),
			)
			.limit(1);
		if (!adoption) throw new TagPathNotFound();
		const [created] = await tx
			.insert(realmUnitTagPathApplication)
			.values({
				realmId: input.realmId,
				unitId: input.unitId,
				senseId: input.senseId,
				createdByProfileId: input.profileId,
			})
			.onConflictDoNothing()
			.returning({ id: realmUnitTagPathApplication.id });
		const [application] = created
			? [created]
			: await tx
					.select({ id: realmUnitTagPathApplication.id })
					.from(realmUnitTagPathApplication)
					.where(
						and(
							eq(realmUnitTagPathApplication.realmId, input.realmId),
							eq(realmUnitTagPathApplication.unitId, input.unitId),
							eq(realmUnitTagPathApplication.senseId, input.senseId),
						),
					)
					.limit(1);
		if (!application) throw new TagPathApplicationNotFound();
		await upsertRealmApplicationJudgment(tx, {
			applicationId: application.id,
			profileId: input.profileId,
			fitVote: input.fitVote ?? 1,
			spoilerLevel: input.spoilerLevel,
		});
		return { applicationId: application.id, senseId: input.senseId, created: Boolean(created) };
	});
}

async function upsertRealmApplicationJudgment(
	tx: DatabaseTransaction,
	input: {
		readonly applicationId: string;
		readonly profileId: string;
		readonly fitVote?: BinaryVote | null;
		readonly spoilerLevel?: SpoilerLevel | null;
	},
) {
	const now = new Date();
	const fitProvided = input.fitVote !== undefined;
	const spoilerProvided = input.spoilerLevel !== undefined;
	if (!fitProvided && !spoilerProvided) return;
	await tx
		.insert(realmUnitTagPathApplicationJudgment)
		.values({
			applicationId: input.applicationId,
			profileId: input.profileId,
			fitVote: input.fitVote,
			spoilerLevel: input.spoilerLevel,
			fitUpdatedAt: fitProvided && input.fitVote !== null ? now : null,
			spoilerUpdatedAt: spoilerProvided && input.spoilerLevel !== null ? now : null,
		})
		.onConflictDoUpdate({
			target: [
				realmUnitTagPathApplicationJudgment.applicationId,
				realmUnitTagPathApplicationJudgment.profileId,
			],
			set: {
				...(fitProvided
					? { fitVote: input.fitVote, fitUpdatedAt: input.fitVote === null ? null : now }
					: {}),
				...(spoilerProvided
					? {
							spoilerLevel: input.spoilerLevel,
							spoilerUpdatedAt: input.spoilerLevel === null ? null : now,
						}
					: {}),
				updatedAt: now,
			},
		});
}

export async function removeRealmTagPathApplication(input: {
	readonly realmId: string;
	readonly unitId: string;
	readonly applicationId: string;
}) {
	const deleted = await database
		.delete(realmUnitTagPathApplication)
		.where(
			and(
				eq(realmUnitTagPathApplication.id, input.applicationId),
				eq(realmUnitTagPathApplication.realmId, input.realmId),
				eq(realmUnitTagPathApplication.unitId, input.unitId),
			),
		)
		.returning({ id: realmUnitTagPathApplication.id });
	if (!deleted.length) throw new TagPathApplicationNotFound();
	return { applicationId: input.applicationId, applied: false as const };
}

export async function judgeRealmTagPathApplication(input: {
	readonly applicationId: string;
	readonly realmId: string;
	readonly unitId: string;
	readonly profileId: string;
	readonly fitVote?: BinaryVote | null;
	readonly spoilerLevel?: SpoilerLevel | null;
}) {
	await database.transaction(async (tx) => {
		const [application] = await tx
			.select({ id: realmUnitTagPathApplication.id })
			.from(realmUnitTagPathApplication)
			.where(
				and(
					eq(realmUnitTagPathApplication.id, input.applicationId),
					eq(realmUnitTagPathApplication.realmId, input.realmId),
					eq(realmUnitTagPathApplication.unitId, input.unitId),
				),
			)
			.limit(1);
		if (!application) throw new TagPathApplicationNotFound();
		await upsertRealmApplicationJudgment(tx, input);
	});
	return { applicationId: input.applicationId };
}

export async function clearRealmTagPathApplicationJudgment(input: {
	readonly applicationId: string;
	readonly realmId: string;
	readonly unitId: string;
	readonly profileId: string;
}) {
	const [application] = await database
		.select({ id: realmUnitTagPathApplication.id })
		.from(realmUnitTagPathApplication)
		.where(
			and(
				eq(realmUnitTagPathApplication.id, input.applicationId),
				eq(realmUnitTagPathApplication.realmId, input.realmId),
				eq(realmUnitTagPathApplication.unitId, input.unitId),
			),
		)
		.limit(1);
	if (!application) throw new TagPathApplicationNotFound();
	await database
		.delete(realmUnitTagPathApplicationJudgment)
		.where(
			and(
				eq(realmUnitTagPathApplicationJudgment.applicationId, input.applicationId),
				eq(realmUnitTagPathApplicationJudgment.profileId, input.profileId),
			),
		);
	return { applicationId: input.applicationId };
}

export async function listRealmTagPaths(input: {
	readonly realmId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
	readonly viewerProfileId?: string;
}) {
	const rows = await database
		.select({
			pathId: realmTagPath.pathId,
			score: realmTagPathVoteStat.score,
			voteCount: realmTagPathVoteStat.voteCount,
			usageCount: realmTagPathVoteStat.usageCount,
			viewerVote: viewerRealmDefinitionVote.value,
		})
		.from(realmTagPath)
		.leftJoin(
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
		.where(eq(realmTagPath.realmId, input.realmId))
		.orderBy(desc(realmTagPathVoteStat.usageCount), realmTagPath.pathId)
		.limit(input.limit);
	const pathIds = rows.map((row) => row.pathId);
	const [members, senseRows, realmRecord] = await Promise.all([
		listPathMembers(pathIds, input.localizationLanguages),
		pathIds.length
			? database
					.select({
						pathId: realmTagPathSense.pathId,
						senseId: realmTagPathSense.senseId,
						expressionId: tagPathSense.expressionId,
					})
					.from(realmTagPathSense)
					.innerJoin(tagPathSense, eq(tagPathSense.id, realmTagPathSense.senseId))
					.where(
						and(
							eq(realmTagPathSense.realmId, input.realmId),
							inArray(realmTagPathSense.pathId, pathIds),
							eq(tagPathSense.status, "active"),
							isNotNull(tagPathSense.sealedAt),
						),
					)
					.orderBy(realmTagPathSense.pathId, realmTagPathSense.senseId)
			: [],
		database
			.select({
				id: realm.id,
				fitFallbackPolicy: realm.tagFitFallbackPolicy,
				spoilerFallbackPolicy: realm.tagSpoilerFallbackPolicy,
			})
			.from(realm)
			.where(eq(realm.id, input.realmId))
			.limit(1),
	]);
	const policy = realmRecord[0];
	if (!policy) throw new RealmNotFound();
	const expressions = await listExpressionDefinitions(
		[...new Set(senseRows.map((sense) => sense.expressionId))],
		input.localizationLanguages,
	);
	const sensesByPath = new Map<
		string,
		Array<{ readonly senseId: string; readonly expression: TagExpressionDefinition }>
	>();
	for (const sense of senseRows) {
		const expression = expressions.get(sense.expressionId);
		if (!expression) continue;
		const senses = sensesByPath.get(sense.pathId) ?? [];
		senses.push({ senseId: sense.senseId, expression });
		sensesByPath.set(sense.pathId, senses);
	}
	return {
		items: rows.map((row) => ({
			pathId: row.pathId,
			score: toSafeInteger(row.score ?? 0n, "Realm Tag Path score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "Realm Tag Path vote count"),
			usageCount: toSafeInteger(row.usageCount ?? 0n, "Realm Tag Path usage count"),
			viewerVote: presentVote(row.viewerVote),
			members: members.get(row.pathId) ?? [],
			senses: sensesByPath.get(row.pathId) ?? [],
		})),
		policy: {
			fitFallbackPolicy: policy.fitFallbackPolicy,
			spoilerFallbackPolicy: policy.spoilerFallbackPolicy,
		},
	};
}

export async function updateRealmTagPathFallbackPolicy(input: {
	readonly realmId: string;
	readonly fitFallbackPolicy: "inherit" | "isolate";
	readonly spoilerFallbackPolicy: "inherit" | "isolate";
}) {
	const [updated] = await database
		.update(realm)
		.set({
			tagFitFallbackPolicy: input.fitFallbackPolicy,
			tagSpoilerFallbackPolicy: input.spoilerFallbackPolicy,
			updatedAt: new Date(),
		})
		.where(eq(realm.id, input.realmId))
		.returning({
			realmId: realm.id,
			fitFallbackPolicy: realm.tagFitFallbackPolicy,
			spoilerFallbackPolicy: realm.tagSpoilerFallbackPolicy,
		});
	if (!updated) throw new RealmNotFound();
	return updated;
}
