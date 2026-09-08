import { and, inArray, isNull, sql } from "drizzle-orm";

import { database } from "../database";
import { tag, unitLocalization, unitOwnership } from "../database/schema";
import { fractionalPositionAt } from "../ordering/position";
import { ContentLabelRegistryIds, ContentLabelRegistryManifest } from "./data";

/** Verifies all fixed label identities, policies, ownership, and starter titles. */
export async function isContentLabelRegistryReady(): Promise<boolean> {
	const [tags, owners, localizations] = await Promise.all([
		database
			.select({
				id: tag.id,
				kind: sql<"tag">`'tag'`,
				status: tag.status,
				visibility: tag.visibility,
				moderationStatus: tag.moderationStatus,
				deletedAt: tag.deletedAt,
				directlyApplicable: tag.directlyApplicable,
				defaultSpoilerLevel: tag.defaultSpoilerLevel,
			})
			.from(tag)
			.where(inArray(tag.id, ContentLabelRegistryIds)),
		database
			.select({ unitId: unitOwnership.unitId, profileId: unitOwnership.profileId })
			.from(unitOwnership)
			.where(
				and(
					inArray(unitOwnership.unitId, ContentLabelRegistryIds),
					isNull(unitOwnership.revokedAt),
				),
			),
		database
			.select({
				unitId: unitLocalization.unitId,
				language: unitLocalization.language,
				position: unitLocalization.position,
				title: unitLocalization.title,
			})
			.from(unitLocalization)
			.where(inArray(unitLocalization.unitId, ContentLabelRegistryIds)),
	]);
	return (
		tags.length === ContentLabelRegistryManifest.length &&
		ContentLabelRegistryManifest.every((expected) =>
			tags.some(
				(actual) =>
					actual.id === expected.id &&
					actual.kind === "tag" &&
					actual.status === "published" &&
					actual.visibility === "public" &&
					actual.moderationStatus === "approved" &&
					actual.deletedAt === null &&
					!actual.directlyApplicable &&
					actual.defaultSpoilerLevel === null,
			),
		) &&
		owners.length === ContentLabelRegistryManifest.length &&
		ContentLabelRegistryManifest.every((expected) =>
			owners.some(
				(actual) => actual.unitId === expected.id && actual.profileId === expected.ownerProfileId,
			),
		) &&
		localizations.length ===
			ContentLabelRegistryManifest.reduce(
				(total, expected) => total + expected.localizations.length,
				0,
			) &&
		ContentLabelRegistryManifest.every((expected) =>
			expected.localizations.every((expectedLocalization, index) =>
				localizations.some(
					(actual) =>
						actual.unitId === expected.id &&
						actual.language === expectedLocalization.language &&
						actual.position === fractionalPositionAt(index) &&
						actual.title === expectedLocalization.title,
				),
			),
		)
	);
}
