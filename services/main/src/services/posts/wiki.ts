import type { PortableTextDocument } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";

import type { Authorization } from "../authorization";
import {
	createProfileOwnedUnitAccess,
	createPublicEditableUnitAccess,
	grantRealmAccessManagersUnitGovernance,
} from "../authorization/unit/ownership";
import type { DatabaseTransaction } from "../database";
import { post, unitLocalization } from "../database/schema";
import { shouldCreateProfilePublisherAttributionForPost } from "./attribution-policy";
import { applyNewPostTagMentionVotes } from "./tag-mentions";
import { publishPostToRealms } from "./publication";
import { ensureSubjectPostTargetingAllowed } from "./targeting";
import { createProfilePublisherAttribution } from "../units/attribution";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { resolveCanonicalUnitId } from "../units/merge/canonical";

export type CreateWikiPostInput = {
	readonly profileId: string;
	readonly authorization: Authorization<string>;
	readonly accessMode: "community_owned" | "restricted";
	readonly title: string;
	readonly summary?: string;
	readonly body: PortableTextDocument;
	readonly language: ContentLanguage;
	readonly publishRealmIds: readonly string[];
	readonly governanceRealmId?: string;
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
	const subjectId = input.subjectId ? await resolveCanonicalUnitId(tx, input.subjectId) : undefined;
	if (subjectId)
		await input.authorization.entity.ensureSubjectAssociationAllowedIfEntity(tx, subjectId);
	const created = await insertUnit(tx, {
		kind: "post",
		status: "published",
		visibility: "public",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.profileId },
	});
	await ensureSubjectPostTargetingAllowed(tx, {
		sourcePostId: created.id,
		subjectUnitId: subjectId,
		realmIds: input.publishRealmIds,
	});
	await tx.insert(post).values({
		id: created.id,
		kind: "wiki",
		subjectUnitId: subjectId,
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
	const ownershipMode =
		input.accessMode === "community_owned" ? "community_owned" : "profile_owned";
	if (ownershipMode === "community_owned") await createPublicEditableUnitAccess(tx, created.id);
	else await createProfileOwnedUnitAccess(tx, created.id, input.profileId);
	if (input.governanceRealmId)
		await grantRealmAccessManagersUnitGovernance(tx, {
			unitId: created.id,
			realmId: input.governanceRealmId,
			grantedByProfileId: input.profileId,
		});
	if (shouldCreateProfilePublisherAttributionForPost(ownershipMode))
		await createProfilePublisherAttribution(tx, {
			sourceUnitId: created.id,
			profileId: input.profileId,
		});
	await publishPostToRealms(tx, {
		postId: created.id,
		realmIds: input.publishRealmIds,
		actorProfileId: input.profileId,
	});
	const revision = await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.profileId,
		event: "create",
	});
	return { id: created.id, revisionId: revision.revisionId };
}
