import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { DatabaseTransaction } from "../database";
import { database } from "../database";
import {
	tag,
	tagExpression,
	tagExpressionArgument,
	tagExpressionGroupKey,
	tagExpressionEffectiveTag,
	tagExpressionInferenceRule,
	tagExpressionLabelComponent,
	tagExpressionPresentationRevision,
	unit,
	type TagExpressionArgumentRole,
	type TagExpressionInferenceKind,
	type TagExpressionKind,
	type TagExpressionLabelComponentKind,
} from "../database/schema";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";

const expressionComponentUnit = alias(unit, "tag_expression_read_component_unit");

export type TagExpressionComponent = {
	readonly tagId: string;
	readonly semanticRole: TagExpressionArgumentRole;
	readonly componentKind: "required" | "fallback";
	readonly language: ContentLanguage | null;
	readonly title: string | null;
};

export type TagExpressionDefinition = {
	readonly expressionId: string;
	readonly expressionKind: TagExpressionKind;
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

/** Batch-hydrates current immutable presentation revisions for bounded definition sets. */
export async function readTagExpressionDefinitions(
	expressionIds: readonly string[],
	localizationLanguages?: LocalizationLanguageQuery,
): Promise<Map<string, TagExpressionDefinition>> {
	if (!expressionIds.length) return new Map();
	const uniqueExpressionIds = [...new Set(expressionIds)];
	const [expressions, components, groups] = await Promise.all([
		database
			.select({
				expressionId: tagExpression.id,
				expressionKind: tagExpression.expressionKind,
				focusTagId: tagExpression.focusTagId,
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
			.where(inArray(tagExpression.id, uniqueExpressionIds)),
		database
			.select({
				expressionId: tagExpressionPresentationRevision.expressionId,
				tagId: tagExpressionLabelComponent.tagId,
				semanticRole: tagExpressionLabelComponent.semanticRole,
				componentKind: tagExpressionLabelComponent.componentKind,
				language: resolvedUnitLocalizationLanguage(
					expressionComponentUnit.id,
					localizationLanguages,
				),
				title: resolvedUnitLocalizationTitle(expressionComponentUnit.id, localizationLanguages),
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
			.innerJoin(
				expressionComponentUnit,
				eq(expressionComponentUnit.id, tagExpressionLabelComponent.tagId),
			)
			.where(inArray(tagExpressionPresentationRevision.expressionId, uniqueExpressionIds))
			.orderBy(tagExpressionPresentationRevision.expressionId, tagExpressionLabelComponent.ordinal),
		database
			.select({
				expressionId: tagExpressionPresentationRevision.expressionId,
				tagId: tagExpressionGroupKey.tagId,
				semanticRole: tagExpressionGroupKey.semanticRole,
				language: resolvedUnitLocalizationLanguage(
					expressionComponentUnit.id,
					localizationLanguages,
				),
				title: resolvedUnitLocalizationTitle(expressionComponentUnit.id, localizationLanguages),
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
			.innerJoin(
				expressionComponentUnit,
				eq(expressionComponentUnit.id, tagExpressionGroupKey.tagId),
			)
			.where(inArray(tagExpressionPresentationRevision.expressionId, uniqueExpressionIds)),
	]);
	const componentsByExpression = new Map<string, TagExpressionComponent[]>();
	for (const component of components) {
		const values = componentsByExpression.get(component.expressionId) ?? [];
		values.push(component);
		componentsByExpression.set(component.expressionId, values);
	}
	const groupByExpression = new Map(groups.map((group) => [group.expressionId, group] as const));
	return new Map(
		expressions.map((expression) => {
			const group = groupByExpression.get(expression.expressionId);
			return [
				expression.expressionId,
				{
					...expression,
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

/**
 * Lists bounded definition-scale semantic uses of one concept. Corpus usage is
 * deliberately left to the paginated Search surface.
 */
export async function listTagConceptExpressions(input: {
	readonly tagId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
}) {
	const expressionRows = await database
		.selectDistinct({
			expressionId: tagExpression.id,
			expressionKind: tagExpression.expressionKind,
		})
		.from(tagExpressionArgument)
		.innerJoin(tagExpression, eq(tagExpression.id, tagExpressionArgument.expressionId))
		.where(
			and(
				eq(tagExpressionArgument.tagId, input.tagId),
				eq(tagExpression.status, "active"),
				isNotNull(tagExpression.sealedAt),
			),
		)
		.orderBy(
			sql`case when ${tagExpression.expressionKind} = 'simple' then 0 else 1 end`,
			tagExpression.id,
		)
		.limit(input.limit);
	const expressionIds = expressionRows.map((row) => row.expressionId);
	const [roles, inferredRows] = await Promise.all([
		expressionIds.length
			? database
					.select({
						expressionId: tagExpressionArgument.expressionId,
						role: tagExpressionArgument.role,
					})
					.from(tagExpressionArgument)
					.where(
						and(
							inArray(tagExpressionArgument.expressionId, expressionIds),
							eq(tagExpressionArgument.tagId, input.tagId),
						),
					)
					.orderBy(tagExpressionArgument.expressionId, tagExpressionArgument.role)
			: [],
		database
			.select({
				expressionId: tagExpressionEffectiveTag.expressionId,
				evidenceKind: tagExpressionEffectiveTag.evidenceKind,
			})
			.from(tagExpressionEffectiveTag)
			.innerJoin(tagExpression, eq(tagExpression.id, tagExpressionEffectiveTag.expressionId))
			.where(
				and(
					eq(tagExpressionEffectiveTag.tagId, input.tagId),
					sql`${tagExpressionEffectiveTag.evidenceKind} <> 'primary'`,
					eq(tagExpression.status, "active"),
					isNotNull(tagExpression.sealedAt),
				),
			)
			.orderBy(tagExpressionEffectiveTag.evidenceKind, tagExpressionEffectiveTag.expressionId)
			.limit(input.limit),
	]);
	const definitions = await readTagExpressionDefinitions(
		[...expressionIds, ...inferredRows.map((row) => row.expressionId)],
		input.localizationLanguages,
	);
	const rolesByExpression = new Map<string, TagExpressionArgumentRole[]>();
	for (const role of roles) {
		const values = rolesByExpression.get(role.expressionId) ?? [];
		values.push(role.role);
		rolesByExpression.set(role.expressionId, values);
	}
	const directExpressionId = expressionRows.find(
		(row) => row.expressionKind === "simple",
	)?.expressionId;
	return {
		directExpression: directExpressionId ? (definitions.get(directExpressionId) ?? null) : null,
		qualifiedExpressions: expressionRows.flatMap((row) => {
			if (row.expressionKind === "simple") return [];
			const expression = definitions.get(row.expressionId);
			return expression
				? [{ expression, roles: rolesByExpression.get(row.expressionId) ?? [] }]
				: [];
		}),
		inferredReach: inferredRows.flatMap((row) => {
			if (row.evidenceKind === "primary") return [];
			const expression = definitions.get(row.expressionId);
			return expression ? [{ expression, evidenceKind: row.evidenceKind }] : [];
		}),
	};
}

export type TagExpressionArgumentInput = {
	readonly role: TagExpressionArgumentRole;
	readonly ordinal: number;
	readonly tagId: string;
};

export type TagExpressionLabelComponentInput = {
	readonly tagId: string;
	readonly semanticRole: TagExpressionArgumentRole;
	readonly componentKind: TagExpressionLabelComponentKind;
};

export type CreateTagExpressionInput = {
	readonly expressionId?: string;
	readonly expressionKind: TagExpressionKind;
	readonly canonicalClaimKey: string;
	readonly focusTagId: string;
	readonly arguments: readonly TagExpressionArgumentInput[];
	readonly labelComponents: readonly TagExpressionLabelComponentInput[];
	readonly groupKey: {
		readonly tagId: string;
		readonly semanticRole: TagExpressionArgumentRole;
	} | null;
	readonly profileId?: string;
	readonly createdAt?: Date;
};

export type CreateTagExpressionResult = {
	readonly expressionId: string;
	readonly created: boolean;
	readonly presentationRevision: number;
};

function orderedArguments(arguments_: readonly TagExpressionArgumentInput[]) {
	return [...arguments_].sort(
		(left, right) =>
			left.role.localeCompare(right.role) ||
			left.ordinal - right.ordinal ||
			left.tagId.localeCompare(right.tagId),
	);
}

function validateExpressionInput(input: CreateTagExpressionInput): void {
	if (!input.canonicalClaimKey.trim() || input.canonicalClaimKey.length > 2048)
		throw new TypeError("Invalid Tag Expression claim key");
	if (input.arguments.length === 0 || input.labelComponents.length === 0)
		throw new TypeError("A Tag Expression needs arguments and a standalone label signature");
	const argumentKeys = input.arguments.map((argument) => `${argument.role}:${argument.ordinal}`);
	if (new Set(argumentKeys).size !== argumentKeys.length)
		throw new TypeError("Tag Expression argument identities must be unique");
	if (
		input.arguments.some(
			(argument) => argument.ordinal < 0 || !Number.isSafeInteger(argument.ordinal),
		)
	)
		throw new TypeError("Invalid Tag Expression argument ordinal");
	const argumentSemanticKeys = new Set(
		input.arguments.map((argument) => `${argument.tagId}:${argument.role}`),
	);
	for (const component of input.labelComponents)
		if (!argumentSemanticKeys.has(`${component.tagId}:${component.semanticRole}`))
			throw new TypeError("Every label component must reference an Expression argument");
	if (
		input.groupKey &&
		!argumentSemanticKeys.has(`${input.groupKey.tagId}:${input.groupKey.semanticRole}`)
	)
		throw new TypeError("The Expression group key must reference an Expression argument");
}

function sameArguments(
	left: readonly TagExpressionArgumentInput[],
	right: readonly TagExpressionArgumentInput[],
): boolean {
	const orderedLeft = orderedArguments(left);
	const orderedRight = orderedArguments(right);
	return (
		orderedLeft.length === orderedRight.length &&
		orderedLeft.every(
			(argument, index) =>
				argument.role === orderedRight[index]?.role &&
				argument.ordinal === orderedRight[index]?.ordinal &&
				argument.tagId === orderedRight[index]?.tagId,
		)
	);
}

function samePresentation(
	left: readonly TagExpressionLabelComponentInput[],
	right: readonly TagExpressionLabelComponentInput[],
): boolean {
	return (
		left.length === right.length &&
		left.every(
			(component, index) =>
				component.tagId === right[index]?.tagId &&
				component.semanticRole === right[index]?.semanticRole &&
				component.componentKind === right[index]?.componentKind,
		)
	);
}

async function ensureTagsExist(tx: DatabaseTransaction, tagIds: readonly string[]): Promise<void> {
	const uniqueIds = [...new Set(tagIds)];
	const existing = await tx.select({ id: tag.id }).from(tag).where(inArray(tag.id, uniqueIds));
	if (existing.length !== uniqueIds.length) throw new TypeError("Unknown Tag Expression argument");
}

async function replacePresentationIfNeeded(
	tx: DatabaseTransaction,
	expressionId: string,
	input: CreateTagExpressionInput,
): Promise<number> {
	const [active] = await tx
		.select({
			id: tagExpressionPresentationRevision.id,
			revision: tagExpressionPresentationRevision.revision,
		})
		.from(tagExpressionPresentationRevision)
		.where(
			and(
				eq(tagExpressionPresentationRevision.expressionId, expressionId),
				eq(tagExpressionPresentationRevision.status, "active"),
			),
		)
		.limit(1);
	if (active) {
		const [components, groupRows] = await Promise.all([
			tx
				.select({
					tagId: tagExpressionLabelComponent.tagId,
					semanticRole: tagExpressionLabelComponent.semanticRole,
					componentKind: tagExpressionLabelComponent.componentKind,
				})
				.from(tagExpressionLabelComponent)
				.where(eq(tagExpressionLabelComponent.presentationRevisionId, active.id))
				.orderBy(asc(tagExpressionLabelComponent.ordinal)),
			tx
				.select({
					tagId: tagExpressionGroupKey.tagId,
					semanticRole: tagExpressionGroupKey.semanticRole,
				})
				.from(tagExpressionGroupKey)
				.where(eq(tagExpressionGroupKey.presentationRevisionId, active.id))
				.limit(1),
		]);
		const group = groupRows[0] ?? null;
		if (
			samePresentation(components, input.labelComponents) &&
			group?.tagId === input.groupKey?.tagId &&
			group?.semanticRole === input.groupKey?.semanticRole &&
			(group === null) === (input.groupKey === null)
		)
			return active.revision;
		await tx
			.update(tagExpressionPresentationRevision)
			.set({ status: "retired", retiredAt: input.createdAt ?? new Date() })
			.where(eq(tagExpressionPresentationRevision.id, active.id));
	}
	const nextRevision = (active?.revision ?? 0) + 1;
	const [created] = await tx
		.insert(tagExpressionPresentationRevision)
		.values({
			expressionId,
			revision: nextRevision,
			createdByProfileId: input.profileId,
			createdAt: input.createdAt,
		})
		.returning({ id: tagExpressionPresentationRevision.id });
	if (!created) throw new Error("Tag Expression presentation was not created");
	await tx.insert(tagExpressionLabelComponent).values(
		input.labelComponents.map((component, ordinal) => ({
			presentationRevisionId: created.id,
			ordinal,
			...component,
		})),
	);
	if (input.groupKey)
		await tx.insert(tagExpressionGroupKey).values({
			presentationRevisionId: created.id,
			...input.groupKey,
		});
	await tx
		.update(tagExpressionPresentationRevision)
		.set({ sealedAt: input.createdAt ?? new Date() })
		.where(eq(tagExpressionPresentationRevision.id, created.id));
	return nextRevision;
}

/** Creates or resolves one immutable semantic claim and independently revisions its presentation. */
export async function createTagExpressionInTransaction(
	tx: DatabaseTransaction,
	input: CreateTagExpressionInput,
): Promise<CreateTagExpressionResult> {
	validateExpressionInput(input);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`tag-expression:${input.canonicalClaimKey}`}::text, 0))`,
	);
	await ensureTagsExist(tx, [
		input.focusTagId,
		...input.arguments.map((argument) => argument.tagId),
	]);
	const [existing] = await tx
		.select({
			id: tagExpression.id,
			expressionKind: tagExpression.expressionKind,
			focusTagId: tagExpression.focusTagId,
			status: tagExpression.status,
		})
		.from(tagExpression)
		.where(eq(tagExpression.canonicalClaimKey, input.canonicalClaimKey))
		.limit(1);
	let expressionId = existing?.id;
	let created = false;
	if (existing) {
		if (existing.status !== "active")
			throw new TypeError("A retired Tag Expression cannot be reused");
		const storedArguments = await tx
			.select({
				role: tagExpressionArgument.role,
				ordinal: tagExpressionArgument.ordinal,
				tagId: tagExpressionArgument.tagId,
			})
			.from(tagExpressionArgument)
			.where(eq(tagExpressionArgument.expressionId, existing.id));
		if (
			existing.expressionKind !== input.expressionKind ||
			existing.focusTagId !== input.focusTagId ||
			!sameArguments(storedArguments, input.arguments)
		)
			throw new TypeError("The canonical Tag Expression claim key has different semantics");
	} else {
		if (input.expressionId) {
			const [idCollision] = await tx
				.select({ claimKey: tagExpression.canonicalClaimKey })
				.from(tagExpression)
				.where(eq(tagExpression.id, input.expressionId))
				.limit(1);
			if (idCollision) throw new TypeError("Tag Expression ID is already assigned");
		}
		const [inserted] = await tx
			.insert(tagExpression)
			.values({
				id: input.expressionId,
				expressionKind: input.expressionKind,
				canonicalClaimKey: input.canonicalClaimKey,
				focusTagId: input.focusTagId,
				createdByProfileId: input.profileId,
				createdAt: input.createdAt,
			})
			.returning({ id: tagExpression.id });
		if (!inserted) throw new Error("Tag Expression was not created");
		expressionId = inserted.id;
		created = true;
		await tx
			.insert(tagExpressionArgument)
			.values(input.arguments.map((argument) => ({ expressionId: inserted.id, ...argument })));
		await tx
			.update(tagExpression)
			.set({ sealedAt: input.createdAt ?? new Date() })
			.where(eq(tagExpression.id, inserted.id));
	}
	if (!expressionId) throw new Error("Tag Expression identity was not resolved");
	const presentationRevision = await replacePresentationIfNeeded(tx, expressionId, input);
	return { expressionId, created, presentationRevision };
}

export async function createTagExpression(input: CreateTagExpressionInput) {
	return database.transaction((tx) => createTagExpressionInTransaction(tx, input));
}

/** Establishes the one-to-one semantic identity used when a bare Tag is applied directly. */
export async function ensureSimpleTagExpressionInTransaction(
	tx: DatabaseTransaction,
	input: {
		readonly tagId: string;
		readonly profileId?: string;
		readonly createdAt?: Date;
	},
) {
	return createTagExpressionInTransaction(tx, {
		expressionKind: "simple",
		canonicalClaimKey: `tag:${input.tagId}`,
		focusTagId: input.tagId,
		arguments: [{ role: "focus", ordinal: 0, tagId: input.tagId }],
		labelComponents: [
			{
				tagId: input.tagId,
				semanticRole: "focus",
				componentKind: "required",
			},
		],
		groupKey: null,
		profileId: input.profileId,
		createdAt: input.createdAt,
	});
}

export type CreateTagExpressionInferenceRuleInput = {
	readonly sourceExpressionId: string;
	readonly targetTagId?: string;
	readonly targetExpressionId?: string;
	readonly inferenceKind: TagExpressionInferenceKind;
	readonly provenance?: Readonly<Record<string, unknown>>;
	readonly profileId?: string;
	readonly createdAt?: Date;
};

/** Adds a governed rule revision and refreshes only the affected definition-scale closure. */
export async function createTagExpressionInferenceRuleInTransaction(
	tx: DatabaseTransaction,
	input: CreateTagExpressionInferenceRuleInput,
): Promise<{ readonly ruleId: string; readonly created: boolean }> {
	if ((input.targetTagId === undefined) === (input.targetExpressionId === undefined))
		throw new TypeError("An inference rule needs exactly one target");
	const lockKey = JSON.stringify([
		input.sourceExpressionId,
		input.targetTagId ?? null,
		input.targetExpressionId ?? null,
		input.inferenceKind,
	]);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`tag-expression-rule:${lockKey}`}::text, 0))`,
	);
	const [sourceRows, targetRows] = await Promise.all([
		tx
			.select({ id: tagExpression.id })
			.from(tagExpression)
			.where(
				and(
					eq(tagExpression.id, input.sourceExpressionId),
					eq(tagExpression.status, "active"),
					isNotNull(tagExpression.sealedAt),
				),
			)
			.limit(1),
		input.targetTagId
			? tx.select({ id: tag.id }).from(tag).where(eq(tag.id, input.targetTagId)).limit(1)
			: tx
					.select({ id: tagExpression.id })
					.from(tagExpression)
					.where(
						and(
							eq(tagExpression.id, input.targetExpressionId!),
							eq(tagExpression.status, "active"),
							isNotNull(tagExpression.sealedAt),
						),
					)
					.limit(1),
	]);
	if (!sourceRows[0] || !targetRows[0])
		throw new TypeError("Inference rules require active, sealed definitions");
	const targetPredicate = input.targetTagId
		? eq(tagExpressionInferenceRule.targetTagId, input.targetTagId)
		: eq(tagExpressionInferenceRule.targetExpressionId, input.targetExpressionId!);
	const [existing] = await tx
		.select({ id: tagExpressionInferenceRule.id })
		.from(tagExpressionInferenceRule)
		.where(
			and(
				eq(tagExpressionInferenceRule.sourceExpressionId, input.sourceExpressionId),
				targetPredicate,
				eq(tagExpressionInferenceRule.inferenceKind, input.inferenceKind),
				eq(tagExpressionInferenceRule.status, "active"),
			),
		)
		.limit(1);
	if (existing) return { ruleId: existing.id, created: false };
	const [latest] = await tx
		.select({ revision: tagExpressionInferenceRule.revision })
		.from(tagExpressionInferenceRule)
		.where(
			and(
				eq(tagExpressionInferenceRule.sourceExpressionId, input.sourceExpressionId),
				targetPredicate,
				eq(tagExpressionInferenceRule.inferenceKind, input.inferenceKind),
			),
		)
		.orderBy(sql`${tagExpressionInferenceRule.revision} desc`)
		.limit(1);
	const [created] = await tx
		.insert(tagExpressionInferenceRule)
		.values({
			sourceExpressionId: input.sourceExpressionId,
			targetTagId: input.targetTagId,
			targetExpressionId: input.targetExpressionId,
			inferenceKind: input.inferenceKind,
			revision: (latest?.revision ?? 0) + 1,
			provenance: input.provenance,
			createdByProfileId: input.profileId,
			createdAt: input.createdAt,
		})
		.returning({ id: tagExpressionInferenceRule.id });
	if (!created) throw new Error("Tag Expression inference rule was not created");
	return { ruleId: created.id, created: true };
}

export async function createTagExpressionInferenceRule(
	input: CreateTagExpressionInferenceRuleInput,
) {
	return database.transaction((tx) => createTagExpressionInferenceRuleInTransaction(tx, input));
}

/** Retires one immutable rule revision while preserving its governance history. */
export async function retireTagExpressionInferenceRule(input: {
	readonly sourceExpressionId: string;
	readonly ruleId: string;
	readonly retiredAt?: Date;
}): Promise<{ readonly ruleId: string; readonly retired: boolean }> {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtextextended(${`tag-expression-rule-id:${input.ruleId}`}::text, 0))`,
		);
		const [rule] = await tx
			.select({
				id: tagExpressionInferenceRule.id,
				status: tagExpressionInferenceRule.status,
			})
			.from(tagExpressionInferenceRule)
			.where(
				and(
					eq(tagExpressionInferenceRule.id, input.ruleId),
					eq(tagExpressionInferenceRule.sourceExpressionId, input.sourceExpressionId),
				),
			)
			.limit(1);
		if (!rule) throw new TypeError("Unknown Tag Expression inference rule");
		if (rule.status === "retired") return { ruleId: rule.id, retired: false };
		await tx
			.update(tagExpressionInferenceRule)
			.set({ status: "retired", retiredAt: input.retiredAt ?? new Date() })
			.where(eq(tagExpressionInferenceRule.id, rule.id));
		return { ruleId: rule.id, retired: true };
	});
}
