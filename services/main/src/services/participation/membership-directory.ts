import { and, eq, gt, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { accessRepresentation } from "@rezics/schema/postgres/access/access-representation";
import { accessRoleBinding } from "@rezics/schema/postgres/access/access-role-binding";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";
import { allocateAccessSubject } from "../authorization/identities";
import { readFirstPartyCredentialAuthority } from "../auth/credential-authority";
import {
	AccessDenied,
	AccessInputInvalid,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "../authorization/http-errors";
import { requireAccessAdmission, rethrowAccessFailure } from "../authorization/transaction";
import { RequestedAuthoritySelectionSchema } from "../authorization/authority-context";
import { decryptOpaqueValue, encryptOpaqueValue } from "../authorization/opaque-values";
import { organizationEnrollmentScope, organizationMembershipAuthority } from "./membership-policy";
import { publicEntityName } from "./presentation";
import { env } from "../config";
const cursorSchema = z.strictObject({
	source: z.enum(["representation", "binding"]),
	afterId: z.uuid().nullable(),
	expiresAt: z.number(),
});
const settings = {
	secret: env.BETTER_AUTH_SECRET,
	keyContext: "org-enrollment-directory:v1",
	prefix: "rzo1.",
	maximumLength: 512,
};
export const MembershipOrganizationDirectorySchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				key: z.uuid(),
				entityId: z.uuid(),
				name: z.string().nullable(),
				selection: RequestedAuthoritySelectionSchema,
			}),
		)
		.max(50),
	nextCursor: z.string().max(512).nullable(),
	unavailable: z.number().int().nonnegative(),
});
/** Direct representation/binding candidate pages keep the retained Org chooser on native authority. @alpha */
export async function listMembershipManagedOrganizations(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	afterId?: string,
) {
	const credential = await readFirstPartyCredentialAuthority(tx, {
		proof: context.credentialProof(),
		selection: context.selection,
		apiPermission: "access:read",
		requireFreshSession: false,
		requireVerifiedEmail: false,
	});
	const actorId = await allocateAccessSubject(tx, { kind: "principal", id: context.principalId });
	const associated = Buffer.from(
		JSON.stringify([context.principalId, context.selection, context.credentialProof()]),
	);
	let cursor: z.infer<typeof cursorSchema> = {
		source: "representation",
		afterId: null,
		expiresAt: Date.now() + 300000,
	};
	if (afterId) {
		try {
			cursor = cursorSchema.parse(
				JSON.parse(decryptOpaqueValue(afterId, associated, settings).toString()),
			);
			if (cursor.expiresAt <= Date.now()) throw new Error();
		} catch {
			throw new AccessInputInvalid();
		}
	}
	const candidates =
		cursor.source === "representation"
			? await tx
					.select({
						id: accessRepresentation.id,
						entityId: accessRepresentation.entityId,
						revision: accessRepresentation.termsRevision,
					})
					.from(accessRepresentation)
					.where(
						and(
							eq(accessRepresentation.recipientSubjectId, actorId),
							cursor.afterId ? gt(accessRepresentation.id, cursor.afterId) : undefined,
						),
					)
					.orderBy(accessRepresentation.id)
					.limit(51)
			: await tx
					.select({ id: accessRoleBinding.id, scopeId: accessRoleBinding.targetScopeId })
					.from(accessRoleBinding)
					.where(
						and(
							eq(accessRoleBinding.recipientSubjectId, actorId),
							cursor.afterId ? gt(accessRoleBinding.id, cursor.afterId) : undefined,
						),
					)
					.orderBy(accessRoleBinding.id)
					.limit(51);
	const items: z.infer<typeof MembershipOrganizationDirectorySchema>["items"] = [];
	const admissions: SQL<boolean | null>[] = [];
	let unavailable = 0;
	for (const candidate of candidates.slice(0, 50)) {
		let entityId: string | null;
		if ("entityId" in candidate) entityId = candidate.entityId;
		else
			entityId =
				(
					await tx.execute<{ entity: string | null }>(
						sql`select r.target_entity_id as entity from public.access_scope s join public.reference_value r on r.id=s.unit_ref where s.id=${candidate.scopeId}::uuid`,
					)
				).rows[0]?.entity ?? null;
		if (!entityId) continue;
		const [entity] = await tx
			.select({ shape: entityIdentity.shape, name: publicEntityName(entityId) })
			.from(entityIdentity)
			.where(eq(entityIdentity.id, entityId));
		if (entity?.shape !== "organization") continue;
		const selection =
			"revision" in candidate && candidate.revision
				? {
						mode: "represented" as const,
						entityId,
						representations: [{ id: candidate.id, revision: candidate.revision }],
					}
				: { mode: "direct" as const };
		try {
			const scope = await organizationEnrollmentScope(tx, entityId, false),
				selected = new PrincipalRequestContext(
					context.principalId,
					selection,
					context.credentialProof(),
				);
			const authority = await organizationMembershipAuthority(
				tx,
				selected,
				scope.scopeId,
				scope.admission,
				true,
				false,
			);
			await requireAccessAdmission(tx, authority.admission);
			items.push({ key: candidate.id, entityId, name: entity.name, selection });
			admissions.push(authority.admission);
		} catch (error) {
			try {
				rethrowAccessFailure(error);
			} catch (failure) {
				if (failure instanceof AccessUnavailable || failure instanceof AccessRecordUnavailable)
					unavailable++;
				else if (!(failure instanceof AccessDenied)) throw failure;
			}
		}
	}
	if (unavailable>0) throw new AccessUnavailable();
	const next =
		candidates.length > 50
			? { source: cursor.source, afterId: candidates[49]!.id, expiresAt: Date.now() + 300000 }
			: cursor.source === "representation"
				? { source: "binding" as const, afterId: null, expiresAt: Date.now() + 300000 }
				: null;
	await requireAccessAdmission(
		tx,
		sql`(${credential.admission}) ${
			admissions.length
				? sql`and ${sql.join(
						admissions.map((admission) => sql`(${admission})`),
						sql` and `,
					)}`
				: sql``
		}`,
	);
	return {
		items,
		nextCursor: next
			? encryptOpaqueValue(Buffer.from(JSON.stringify(next)), associated, settings)
			: null,
		unavailable,
	};
}
