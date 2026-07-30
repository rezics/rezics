import type { PortableTextDocument } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import type { Authorization } from "../authorization";
import {
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
} from "../authorization/unit/ownership";
import { OfficialProfileIds } from "../bootstrap/manifest";
import type { DatabaseTransaction } from "../database";
import { post, unitLocalization } from "../database/schema";
import { applyNewPostTagMentionVotes } from "./tag-mentions";
import { publishPostToRealms } from "./publication";
import { ensureSubjectPostTargetingAllowed } from "./targeting";
import { createProfilePublisherAttribution } from "../units/attribution";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";

export type CreateWikiPostInput = {
	readonly profileId: string;
	readonly authorization: Authorization<string>;
	readonly accessMode: "public_entry" | "restricted";
	readonly title: string;
	readonly summary?: string;
	readonly body: PortableTextDocument;
	readonly language: ContentLanguage;
	readonly publishRealmIds: readonly string[];
	readonly subjectId?: string;
};

/**
 * Creates a Wiki and all of its owned records inside the caller's transaction.
 *
 * @remarks
 * Realm-specific workflows may append their own relationship row before the
 * transaction commits, so a Wiki and its semantic relationship cannot diverge.
 *
 * @internal
 */
export async function createWikiPost(
	tx: DatabaseTransaction,
	input: CreateWikiPostInput,
): Promise<{ readonly id: string; readonly revisionId: string }> {
	if (input.subjectId)
		await input.authorization.entity.ensureSubjectAssociationAllowedIfEntity(
			tx,
			input.subjectId,
		);
	const created = await insertUnit(tx, {
		kind: "post",
		status: "published",
		visibility: "public",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.profileId },
	});
	await ensureSubjectPostTargetingAllowed(tx, {
		sourcePostId: created.id,
		subjectUnitId: input.subjectId,
		realmIds: input.publishRealmIds,
	});
	await tx.insert(post).values({
		id: created.id,
		kind: "wiki",
		subjectUnitId: input.subjectId,
	});
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: input.language,
		title: input.title,
		summary: input.summary ?? null,
		content: input.body,
		contentStatus: "published",
	});
	await applyNewPostTagMentionVotes(tx, {
		postId: created.id,
		profileId: input.profileId,
		nextBody: input.body,
	});
	if (input.accessMode === "public_entry") await createPublicEditableUnitAccess(tx, created.id);
	else await createProfileOwnedUnitAccess(tx, created.id, input.profileId);
	await createProfilePublisherAttribution(tx, {
		sourceUnitId: created.id,
		profileId:
			input.accessMode === "public_entry" ? OfficialProfileIds.community : input.profileId,
	});
	await publishPostToRealms(tx, {
		postId: created.id,
		realmIds: input.publishRealmIds,
	});
	const revision = await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.profileId,
		event: "create",
	});
	return { id: created.id, revisionId: revision.revisionId };
}
