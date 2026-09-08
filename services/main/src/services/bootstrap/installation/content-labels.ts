import { eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../../database";
import { tag, vocabularyNode } from "../../database/schema";
import { ensureSimpleTagExpressionInTransaction } from "../../tag-expressions/service";
import { fractionalPositionAt } from "../../ordering/position";
import { recordUnitRevision } from "../../units/history";
import { ContentLabelRegistryManifest, TopLevelSlugNamespaceIds } from "../data";
import {
	assertFields,
	bootstrapEpoch,
	ensureBootstrapAddressedUnit,
	ensureOwnership,
	insertStarterLocalization,
} from "./common";

/** Ensures the four fixed content-label Tag identities without rewriting product-owned content. */
export async function ensureContentLabelRegistry(tx: DatabaseTransaction): Promise<void> {
	for (const label of ContentLabelRegistryManifest) {
		const [existingTag] = await tx
			.select({
				id: tag.id,
				directlyApplicable: tag.directlyApplicable,
				defaultSpoilerLevel: tag.defaultSpoilerLevel,
			})
			.from(tag)
			.where(eq(tag.id, label.id))
			.limit(1);
		if (existingTag) {
			assertFields(`content-label Tag ${label.id}`, existingTag, {
				id: label.id,
				directlyApplicable: false,
				defaultSpoilerLevel: null,
			});
		}
		if (!existingTag) {
			await tx
				.insert(vocabularyNode)
				.values({
					id: label.id,
					kind: "concept",
					createdByProfileId: label.ownerProfileId,
					createdAt: bootstrapEpoch(),
				})
				.onConflictDoNothing();
		}
		const createdUnit = await ensureBootstrapAddressedUnit(tx, {
			id: label.id,
			owner: "tag",
			values: { directlyApplicable: false, defaultSpoilerLevel: null },
			scopeNamespaceId: TopLevelSlugNamespaceIds.tags,
			slug: label.slug,
		});

		await ensureSimpleTagExpressionInTransaction(tx, {
			tagId: label.id,
			profileId: label.ownerProfileId,
			createdAt: bootstrapEpoch(),
		});
		await ensureOwnership(tx, label.id, label.ownerProfileId);
		if (createdUnit)
			for (const [index, localization] of label.localizations.entries())
				await insertStarterLocalization(tx, {
					unitId: label.id,
					language: localization.language,
					position: fractionalPositionAt(index),
					title: localization.title,
				});
		if (createdUnit)
			await recordUnitRevision(tx, {
				unitId: label.id,
				actorProfileId: label.ownerProfileId,
				event: "create",
			});
	}
}
