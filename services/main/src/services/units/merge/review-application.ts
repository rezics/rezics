import { and, eq, inArray, sql } from "drizzle-orm";
import { Authorization } from "../../authorization";
import type { GrantedPlatformAccess } from "../../authorization/platform/authorization";
import { PlatformCapabilityRequired } from "../../authorization/errors";
import { AccountClosed, AccountSuspended } from "../../auth/errors";
import type { DatabaseTransaction } from "../../database";
import {
	unitMergeReview,
	unitMergeRequest,
	platformCapabilityGrant,
	participationGrant,
} from "../../database/schema";
import {
	ParticipationAuthoritySchema,
	ParticipationDenied,
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../../participation/policy";
import { withCatalogViewerPolicy } from "../../catalog/read-policy";
import { CatalogAccessDenied, CatalogReferenceNotFound } from "../../catalog/storage";
import { UnitNotFound } from "../errors";
import { humanMergeAuthority } from "./service";
import { assertMergeManifestFingerprint, buildUnitMergeManifest } from "./manifest";
import { MergePlanSchema } from "./contracts";

/** The original review may remain history, but cannot authorize a new canonicalization. @internal */
export class UnitMergeReviewAuthorityChanged extends Error {}

/** Lock exact current reviewer authority and close all grant deadlines at one statement after waits. @internal */
export async function revalidateMergeReviewers(
	tx: DatabaseTransaction,
	request: typeof unitMergeRequest.$inferSelect,
	operationId: string,
	proposerGrant: GrantedPlatformAccess,
	proposerAuthority: ParticipationAuthority,
) {
	const reviews = await tx
		.select({
			reviewerAuthUserId: unitMergeReview.reviewerAuthUserId,
			reviewerProfileId: unitMergeReview.reviewerProfileId,
			reviewerAuthority: unitMergeReview.reviewerAuthority,
			sourceReadGrantId: unitMergeReview.sourceReadGrantId,
			sourceReadGrantRevision: unitMergeReview.sourceReadGrantRevision,
			targetReadGrantId: unitMergeReview.targetReadGrantId,
			targetReadGrantRevision: unitMergeReview.targetReadGrantRevision,
		})
		.from(unitMergeReview)
		.where(and(eq(unitMergeReview.requestId, request.id), eq(unitMergeReview.decision, "approve")))
		.orderBy(unitMergeReview.reviewerAuthUserId)
		.limit(3)
		.for("share");
	if (reviews.length !== 2) throw new UnitMergeReviewAuthorityChanged();
	const platformGrantIds: string[] = [],
		participationGrantIds: string[] = [];
	for (const review of reviews) {
		try {
			const authority = ParticipationAuthoritySchema.parse(review.reviewerAuthority);
			const authorization = new Authorization(
				review.reviewerProfileId,
				review.reviewerAuthUserId,
				authority,
			);
			const grant = await authorization.platform.ensureCapability("unit.merge.review", tx);
			platformGrantIds.push(grant.grantId);
			await humanMergeAuthority(tx, authorization);
			const readGrants = {
				...(review.sourceReadGrantId && review.sourceReadGrantRevision
					? { source: { id: review.sourceReadGrantId, revision: review.sourceReadGrantRevision } }
					: {}),
				...(review.targetReadGrantId && review.targetReadGrantRevision
					? { target: { id: review.targetReadGrantId, revision: review.targetReadGrantRevision } }
					: {}),
			};
			if (authority.grant && (!readGrants.source || !readGrants.target))
				participationGrantIds.push(authority.grant.id);
			if (readGrants.source) participationGrantIds.push(readGrants.source.id);
			if (readGrants.target) participationGrantIds.push(readGrants.target.id);
			const manifest = await runWithParticipationAuthority(authority, () =>
				withCatalogViewerPolicy(tx, review.reviewerAuthUserId, () =>
					buildUnitMergeManifest(
						tx,
						authorization,
						{
							sourceUnitId: request.sourceUnitId,
							targetUnitId: request.targetUnitId,
							plan: MergePlanSchema.parse(request.plan),
							operationId,
						},
						"read",
						readGrants,
					),
				),
			);
			assertMergeManifestFingerprint(manifest, request.requestFingerprint);
		} catch (error) {
			if (
				error instanceof ParticipationDenied ||
				error instanceof PlatformCapabilityRequired ||
				error instanceof AccountClosed ||
				error instanceof AccountSuspended ||
				error instanceof UnitNotFound ||
				error instanceof CatalogAccessDenied ||
				error instanceof CatalogReferenceNotFound
			)
				throw new UnitMergeReviewAuthorityChanged(
					"A reviewer no longer has the admitted authority",
					{ cause: error },
				);
			throw error;
		}
	}
	// These rows were locked by admission. Never substitute a new, unlocked grant here.
	const {
		rows: [deadline],
	} = await tx.execute<{ proposerExpired: boolean; reviewerExpired: boolean }>(sql`select
		exists(select 1 from ${platformCapabilityGrant}
			where ${platformCapabilityGrant.id} = ${proposerGrant.grantId} and ${platformCapabilityGrant.expiresAt} <= statement_timestamp())
		or exists(select 1 from ${participationGrant}
			where ${proposerAuthority.grant ? eq(participationGrant.id, proposerAuthority.grant.id) : sql`false`}
			and ${participationGrant.expiresAt} <= statement_timestamp()) as "proposerExpired",
		exists(select 1 from ${platformCapabilityGrant}
			where ${inArray(platformCapabilityGrant.id, [...new Set(platformGrantIds)])}
			and ${platformCapabilityGrant.expiresAt} <= statement_timestamp())
		or exists(select 1 from ${participationGrant}
			where ${participationGrantIds.length ? inArray(participationGrant.id, [...new Set(participationGrantIds)]) : sql`false`}
			and ${participationGrant.expiresAt} <= statement_timestamp()) as "reviewerExpired"`);
	if (!deadline) throw new Error("Merge deadline check returned no row");
	if (deadline.reviewerExpired)
		throw new UnitMergeReviewAuthorityChanged(
			"An admitted reviewer grant expired before canonicalization",
		);
	if (deadline.proposerExpired) throw new PlatformCapabilityRequired();
}
