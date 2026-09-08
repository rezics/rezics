import { z } from "zod";
import type { UnitOwner } from "@rezics/reference";
import type { Authorization } from "../../authorization";
import { AuthenticationRequired } from "../../auth/errors";
import { database } from "../../database";
import { unitLocalization, vocabularyNode } from "../../database/schema";
import { ensureSimpleTagExpressionInTransaction } from "../../tag-expressions/service";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { createCommunityContributedUnitAccess } from "../../authorization/unit/ownership";
import { insertPlatformUnit } from "../../units/create";
import {
	toUnitLocalizationStorage,
	unitLocalizationImageAssetReferences,
} from "../../units/localization";
import { ensureImageAssetsAttachable } from "../image-assets/service";
import { readUnitStateById } from "../../units/query";
import type { CreateUnitResourceBody } from "./schema";

export async function createTagResource(
	authorization: Authorization<string>,
	body: CreateUnitResourceBody,
) {
	const actor = authorization.authUserId;
	if (!actor) throw new AuthenticationRequired();
	return database.transaction(async (tx) => {
		await ensureImageAssetsAttachable(
			tx,
			actor,
			unitLocalizationImageAssetReferences(body.localization),
		);
		const [node] = await tx
			.insert(vocabularyNode)
			.values({ kind: "concept", createdByProfileId: authorization.profileId })
			.returning({ id: vocabularyNode.id });
		if (!node) throw new Error("Vocabulary creation did not return an identity");
		const created = await insertPlatformUnit(tx, {
			owner: "tag",
			values: {
				id: node.id,
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
				createdByAuthUserId: actor,
			},
			statusActor: { kind: "profile", profileId: authorization.profileId },
		});
		await ensureSimpleTagExpressionInTransaction(tx, {
			tagId: created.id,
			profileId: authorization.profileId,
		});
		await tx
			.insert(unitLocalization)
			.values({ unitId: created.id, ...toUnitLocalizationStorage(body.localization) });
		await createCommunityContributedUnitAccess(tx, created.id, authorization.profileId);
		await recordUnitRevision(tx, {
			unitId: created.id,
			actorProfileId: authorization.profileId,
			contribution: body.revisionContext?.contribution,
			event: "create",
		});
		return created.id;
	});
}
/** Checks the immutable concrete owner named by the route; never guesses a legacy subtype. */
export async function checkUnitOwner(unitId: string, owner: UnitOwner) {
	z.uuid().parse(unitId);
	const current = await readUnitStateById(database, unitId);
	if (!current || current.reference.owner !== owner) throw new UnitNotFound();
}
