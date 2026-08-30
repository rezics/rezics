import type { ContentLanguage } from "@rezics/i18n";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Authorization } from "../authorization";
import { getUnitReadCondition } from "../authorization/unit/query";
import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";
import type { UnitSubjectAssociationListResponse } from "../api/schema/response";
import { contentRatingAllowlistFromStored } from "../content-rating/policy";
import { database } from "../database";
import {
	entity,
	entityMeasurement,
	profilePreference,
	subjectAssociation,
	subjectAssociationJudgment,
	subjectAssociationJudgmentStat,
	unit,
	type EntityKind,
	isEntityKind,
	MaximumSubjectAssociationExpressionsPerItem,
	MaximumSubjectAssociationsPageSize,
} from "../database/schema";
import { presentNullablePortableTextDocument } from "../documents/portable-text-presentation";
import { getAssociationContextPostsByAssociationIds } from "./association-context";
import { getAttributionSummariesByUnitIds } from "./attribution";
import { UnitNotFound } from "./errors";
import {
	resolvedUnitLocalizationDescription,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "./localization";
import { resolveCanonicalUnitId } from "./merge/canonical";
import {
	decodeSubjectAssociationCursor,
	encodeSubjectAssociationCursor,
} from "./subject-association-cursor";
import { presentSubjectAssociationSpoiler } from "./subject-association-spoiler";
import { getSubjectAssociationExpressions } from "./subject-association-tags";
import type { ManageableUnitKind } from "./service";

const associatedEntityUnit = alias(unit, "unit_subject_association_entity_unit");

export interface ListUnitSubjectAssociationsInput {
	readonly kind: ManageableUnitKind;
	readonly unitId: string;
	readonly authorization: Authorization;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly cursor?: string;
	readonly limit: number;
}

function requireEntityKind(value: string): EntityKind {
	if (!isEntityKind(value)) throw new Error("Associated Entity kind is invalid");
	return value;
}

function presentCover(assetId: string | null) {
	return assetId ? { id: assetId, url: imageAssetPresentationContentUrl(assetId, "cover") } : null;
}

type AssociationMeasurement = NonNullable<
	UnitSubjectAssociationListResponse["items"][number]["measurement"]
>;

async function getPreferredMeasurements(
	entityIds: readonly string[],
	contextUnitId: string,
): Promise<ReadonlyMap<string, AssociationMeasurement>> {
	if (!entityIds.length) return new Map();
	const rows = await database
		.select({
			entityId: entityMeasurement.entityId,
			contextUnitId: entityMeasurement.contextUnitId,
			heightMillimetres: entityMeasurement.heightMillimetres,
			weightGrams: entityMeasurement.weightGrams,
			bustMillimetres: entityMeasurement.bustMillimetres,
			waistMillimetres: entityMeasurement.waistMillimetres,
			hipsMillimetres: entityMeasurement.hipsMillimetres,
		})
		.from(entityMeasurement)
		.where(
			and(
				inArray(entityMeasurement.entityId, [...entityIds]),
				or(
					eq(entityMeasurement.contextUnitId, contextUnitId),
					isNull(entityMeasurement.contextUnitId),
				),
			),
		)
		.orderBy(
			entityMeasurement.entityId,
			sql`case when ${entityMeasurement.contextUnitId} = ${contextUnitId}::uuid then 0 else 1 end`,
			entityMeasurement.id,
		)
		.limit(entityIds.length * 2);
	const preferred = new Map<string, AssociationMeasurement>();
	for (const { entityId, ...measurement } of rows) {
		if (!preferred.has(entityId)) preferred.set(entityId, measurement);
	}
	return preferred;
}

/**
 * Lists complete association-card metadata through the
 * `(unit_id, position, id)` index.
 *
 * Work is `O(log N + page size)` at 500M and 3B association rows. The fixed
 * page maximum is eight cards; each card hydrates at most 128 visible
 * Expressions and two relevant measurement candidates. No whole-corpus or
 * per-card query is performed.
 */
export async function listUnitSubjectAssociations(
	input: ListUnitSubjectAssociationsInput,
): Promise<UnitSubjectAssociationListResponse> {
	if (
		!Number.isInteger(input.limit) ||
		input.limit < 1 ||
		input.limit > MaximumSubjectAssociationsPageSize
	)
		throw new RangeError("Subject association page limit is outside its request-path bound");
	const [canonicalUnitId, viewerPreference] = await Promise.all([
		resolveCanonicalUnitId(database, input.unitId),
		input.authorization.profileId
			? database
					.select({
						alwaysShowSpoilers: profilePreference.alwaysShowSpoilers,
						contentRatings: profilePreference.contentRatings,
					})
					.from(profilePreference)
					.where(eq(profilePreference.profileId, input.authorization.profileId))
					.limit(1)
					.then(([row]) => row)
			: Promise.resolve(undefined),
	]);
	const [base] = await database
		.select({ id: unit.id })
		.from(unit)
		.where(and(eq(unit.id, canonicalUnitId), eq(unit.kind, input.kind), isNull(unit.deletedAt)))
		.limit(1);
	if (!base) throw new UnitNotFound(input.kind);
	await input.authorization.unit.ensureCanRead(base.id, () => new UnitNotFound(input.kind));

	const cursorContext = {
		unitId: base.id,
		localizationLanguages: input.localizationLanguages,
		limit: input.limit,
	};
	const cursor = decodeSubjectAssociationCursor(input.cursor, cursorContext);
	const rows = await database
		.select({
			id: subjectAssociation.id,
			entityEntryId: subjectAssociation.entityId,
			entityKind: entity.kind,
			role: subjectAssociation.role,
			position: subjectAssociation.position,
			language: resolvedUnitLocalizationLanguage(
				subjectAssociation.entityId,
				input.localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(
				subjectAssociation.entityId,
				input.localizationLanguages,
			),
			summary: resolvedUnitLocalizationSummary(
				subjectAssociation.entityId,
				input.localizationLanguages,
			),
			description: resolvedUnitLocalizationDescription(
				subjectAssociation.entityId,
				input.localizationLanguages,
			),
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				subjectAssociation.entityId,
				"cover",
				input.localizationLanguages,
			),
			spoilerVoteCount: subjectAssociationJudgmentStat.spoilerVoteCount,
			spoilerNoneCount: subjectAssociationJudgmentStat.spoilerNoneCount,
			spoilerMinorCount: subjectAssociationJudgmentStat.spoilerMinorCount,
			spoilerMajorCount: subjectAssociationJudgmentStat.spoilerMajorCount,
			viewerSpoilerLevel: input.authorization.profileId
				? sql<number | null>`(
						select judgment.spoiler_level
						from ${subjectAssociationJudgment} judgment
						where judgment.association_id = ${subjectAssociation.id}
							and judgment.profile_id = ${input.authorization.profileId}::uuid
					)`
				: sql<number | null>`null`,
		})
		.from(subjectAssociation)
		.innerJoin(entity, eq(entity.id, subjectAssociation.entityId))
		.innerJoin(associatedEntityUnit, eq(associatedEntityUnit.id, subjectAssociation.entityId))
		.leftJoin(
			subjectAssociationJudgmentStat,
			eq(subjectAssociationJudgmentStat.associationId, subjectAssociation.id),
		)
		.where(
			and(
				eq(subjectAssociation.unitId, base.id),
				getUnitReadCondition(input.authorization.profileId, {}, associatedEntityUnit),
				cursor
					? or(
							gt(subjectAssociation.position, cursor.position),
							and(
								eq(subjectAssociation.position, cursor.position),
								gt(subjectAssociation.id, cursor.id),
							),
						)
					: undefined,
			),
		)
		.orderBy(subjectAssociation.position, subjectAssociation.id)
		.limit(input.limit + 1);
	const pageRows = rows.slice(0, input.limit);
	const entityIds = pageRows.map(({ entityEntryId }) => entityEntryId);
	const associationIds = pageRows.map(({ id }) => id);
	const allowedContentRatings = contentRatingAllowlistFromStored(viewerPreference?.contentRatings);
	const [contextPosts, expressionSets, attributions, measurements] = await Promise.all([
		getAssociationContextPostsByAssociationIds(
			associationIds,
			input.localizationLanguages,
			input.authorization.profileId,
		),
		getSubjectAssociationExpressions({
			entityIds,
			localizationLanguages: input.localizationLanguages,
			allowedContentRatings,
			includeSpoilers: viewerPreference?.alwaysShowSpoilers ?? false,
			limit: MaximumSubjectAssociationExpressionsPerItem,
		}),
		getAttributionSummariesByUnitIds(entityIds, input.localizationLanguages),
		getPreferredMeasurements(entityIds, base.id),
	]);

	const last = pageRows.at(-1);
	return {
		items: pageRows.map(
			({
				coverAssetId,
				description,
				spoilerVoteCount,
				spoilerNoneCount,
				spoilerMinorCount,
				spoilerMajorCount,
				viewerSpoilerLevel,
				...association
			}) => {
				const expressionSet = expressionSets.get(association.entityEntryId) ?? {
					expressions: [],
					complete: true,
				};
				return {
					...association,
					entityKind: requireEntityKind(association.entityKind),
					description: presentNullablePortableTextDocument(
						description,
						"unit_localization.description",
					),
					cover: presentCover(coverAssetId),
					expressions: [...expressionSet.expressions],
					expressionsComplete: expressionSet.complete,
					attributions: [...(attributions.get(association.entityEntryId) ?? [])],
					measurement: measurements.get(association.entityEntryId) ?? null,
					contextPost: contextPosts.get(association.id) ?? null,
					spoiler: presentSubjectAssociationSpoiler(
						{
							spoilerVoteCount,
							spoilerNoneCount,
							spoilerMinorCount,
							spoilerMajorCount,
							viewerSpoilerLevel,
						},
						viewerPreference?.alwaysShowSpoilers ?? false,
					),
				};
			},
		),
		nextCursor:
			rows.length > input.limit && last
				? encodeSubjectAssociationCursor({ position: last.position, id: last.id }, cursorContext)
				: null,
	};
}
