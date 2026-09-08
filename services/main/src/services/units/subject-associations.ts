import { isContentLanguage } from "@rezics/i18n";
import { and, eq, gt, or, sql } from "drizzle-orm";

import { imageAssetPresentationContentUrl } from "../api/image-assets/presentation";
import type { UnitSubjectAssociationListResponse } from "../api/schema/response";
import type { Authorization } from "../authorization";
import { contentRatingAllowlistFromStored } from "../content-rating/policy";
import { database } from "../database";
import { readUnitStateById } from "./query";
import { readNativeEntityMeasurements } from "../catalog/entity-measurements-read";
import { readEntityContextMeasurements } from "../catalog/entity-context-measurements";
import { EntityMeasurementContextSchema, type EntityContextMeasurement } from "../catalog/entity-measurement-contracts";
import { withCatalogViewerPolicy } from "../catalog/read-policy";
import { runWithParticipationAuthority } from "../participation/policy";
import { readUnitPresentationsInTransaction } from "./presentation-reader";
import {
	accountPreference,
	entityIdentity,
	MaximumSubjectAssociationExpressionsPerItem,
	MaximumSubjectAssociationsPageSize,
	subjectAssociation,
	subjectAssociationJudgment,
	subjectAssociationJudgmentStat,
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

export interface ListUnitSubjectAssociationsInput {
	readonly unitId: string;
	readonly authorization: Authorization;
	readonly localizationLanguages: readonly string[];
	readonly cursor?: string;
	readonly limit: number;
}

function presentCover(assetId: string | null) {
	return assetId ? { id: assetId, url: imageAssetPresentationContentUrl(assetId, "cover") } : null;
}

/**
 * Lists complete association-card metadata through the
 * `(unit_id, position, id)` index.
 *
 * Work is `O(log N + page size)` at 500M and 3B association rows. The fixed
 * page maximum is eight cards; each card hydrates at most 128 visible
 * Expressions and 65 fact-history candidates per reviewed measurement property. No whole-corpus or
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
	const platformLanguages = input.localizationLanguages.filter(isContentLanguage);
	const read = () => database.transaction(
		async (tx) => withCatalogViewerPolicy(tx, input.authorization.authUserId ?? null, async () => {
			const canonicalUnitId = await resolveCanonicalUnitId(tx, input.unitId);
			const viewerPreference = input.authorization.authUserId
				? (
						await tx
							.select({
								alwaysShowSpoilers: accountPreference.alwaysShowSpoilers,
								contentRatings: accountPreference.contentRatings,
							})
							.from(accountPreference)
							.where(eq(accountPreference.authUserId, input.authorization.authUserId))
							.limit(1)
					)[0]
				: undefined;
			const base = await readUnitStateById(tx, canonicalUnitId);
			if (!base) throw new UnitNotFound();
			await input.authorization.unit.ensureInTransaction(tx, base.id, "unit.read");

			const cursorContext = {
				unitId: base.id,
				localizationLanguages: input.localizationLanguages,
				limit: input.limit,
			};
			const cursor = decodeSubjectAssociationCursor(input.cursor, cursorContext);
			const rows = await tx
				.select({
					id: subjectAssociation.id,
					entityEntryId: subjectAssociation.entityId,
					entityShape: entityIdentity.shape,
					role: subjectAssociation.role,
					position: subjectAssociation.position,
					language: resolvedUnitLocalizationLanguage(
						subjectAssociation.entityId,
						platformLanguages,
					),
					title: resolvedUnitLocalizationTitle(subjectAssociation.entityId, platformLanguages),
					summary: resolvedUnitLocalizationSummary(subjectAssociation.entityId, platformLanguages),
					description: resolvedUnitLocalizationDescription(
						subjectAssociation.entityId,
						platformLanguages,
					),
					coverAssetId: resolvedUnitLocalizationImageAssetId(
						subjectAssociation.entityId,
						"cover",
						platformLanguages,
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
				.innerJoin(entityIdentity, eq(entityIdentity.id, subjectAssociation.entityId))
				.leftJoin(
					subjectAssociationJudgmentStat,
					eq(subjectAssociationJudgmentStat.associationId, subjectAssociation.id),
				)
				.where(
					and(
						eq(subjectAssociation.unitId, base.id),
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
				.limit(input.limit * 4);
			const readable = await input.authorization.unit.readableUnitIdsInTransaction(
				tx,
				rows.map((row) => row.entityEntryId),
			);
			const visibleRows = rows.filter((row) => readable.has(row.entityEntryId));
			const pageRows = visibleRows.slice(0, input.limit);
			const entityIds = pageRows.map(({ entityEntryId }) => entityEntryId);
			const associationIds = pageRows.map(({ id }) => id);
			const allowedContentRatings = contentRatingAllowlistFromStored(
				viewerPreference?.contentRatings,
			);
			const measurementContext = EntityMeasurementContextSchema.safeParse(base.reference);
			const [contextPosts, expressionSets, attributions, measurements, presentations, contextualMeasurements] =
				await Promise.all([
					getAssociationContextPostsByAssociationIds(
						associationIds,
						platformLanguages,
						input.authorization.profileId,
					),
					getSubjectAssociationExpressions({
						entityIds,
						localizationLanguages: platformLanguages,
						allowedContentRatings,
						includeSpoilers: viewerPreference?.alwaysShowSpoilers ?? false,
						limit: MaximumSubjectAssociationExpressionsPerItem,
					}),
					getAttributionSummariesByUnitIds(entityIds, platformLanguages),
					readNativeEntityMeasurements(tx, entityIds),
					readUnitPresentationsInTransaction(tx, entityIds, input.localizationLanguages),
					measurementContext.success
						? readEntityContextMeasurements(tx, entityIds, input.authorization.authUserId ?? null, measurementContext.data,
							viewerPreference?.alwaysShowSpoilers ? 2 : 0)
						: Promise.resolve(new Map<string, EntityContextMeasurement>()),
				]);

			const last =
				visibleRows.length > input.limit
					? pageRows.at(-1)
					: rows.length === input.limit * 4
						? rows.at(-1)
						: undefined;
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
						const contextualMeasurement = contextualMeasurements.get(association.entityEntryId);
						const expressionSet = expressionSets.get(association.entityEntryId) ?? {
							expressions: [],
							complete: true,
						};
						return {
							...association,
							entityOwner: "entity" as const,
							entityShape: association.entityShape,
							language: presentations.get(association.entityEntryId)?.language ?? null,
							title: presentations.get(association.entityEntryId)?.title ?? null,
							description: presentNullablePortableTextDocument(
								description,
								"unit_localization.description",
							),
							cover: presentCover(coverAssetId),
							expressions: [...expressionSet.expressions],
							expressionsComplete: expressionSet.complete,
							attributions: [...(attributions.get(association.entityEntryId) ?? [])],
							measurement: contextualMeasurement
								? { ...contextualMeasurement.values, contextUnitId: base.id }
								: measurements.get(association.entityEntryId) ?? null,
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
				nextCursor: last
					? encodeSubjectAssociationCursor({ position: last.position, id: last.id }, cursorContext)
					: null,
			};
		}),
		{ isolationLevel: "repeatable read" },
	);
	return input.authorization.participationAuthority
		? runWithParticipationAuthority(input.authorization.participationAuthority, read)
		: read();
}
