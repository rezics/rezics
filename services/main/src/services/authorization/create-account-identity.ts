import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { AccessPermissionValues } from "@rezics/access";
import { ContentLanguageValues } from "@rezics/i18n";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { accountIdentityAdmission } from "../database/schema/account-identity-admission";
import { users } from "../database/schema/auth";
import { createParticipantIdentity } from "../participation/identity";
import { applyAccessRepresentationCommand } from "./representations";
import { applyIdentityPreferenceCommand, captureIdentityPreference } from "./identity-preferences";
import { readPrivateAccountAuthority } from "./private-account-authority";
import { AccessChanged, AccessDenied, AccessInputInvalid, AccessUnavailable } from "./http-errors";
import { requireAccessAdmission, runAccessTransaction } from "./transaction";

/** Explicit public presentation and optional main-choice precondition; private provider data is absent. @alpha */
export const CreateAccountIdentitySchema = z.strictObject({
	operationId: z.uuid().toLowerCase(),
	names: z.array(z.strictObject({ language: z.enum(ContentLanguageValues), value: z.string().trim().min(1).max(120) }))
		.max(32).refine(names => new Set(names.map(name => name.language)).size === names.length),
	main: z.strictObject({ expectedVersion: z.number().int().nonnegative().safe() }).nullable(),
});
function receipt(row: typeof accountIdentityAdmission.$inferSelect) {
	return { operationId: row.operationId, entityId: row.entityId,
		representation: { id: row.representationId, revision: 1 }, mainPreferenceVersion: row.mainPreferenceVersion };
}

/**
 * Atomically create a new Entity, direct institutional control and optional private main choice.
 * @internal
 * @remarks No existing Entity identifier is accepted. Receipt replay returns the
 * original outcome and does not renew a revoked grant or retarget a changed default.
 */
export async function createAccountIdentity(context: PrincipalRequestContext, input: z.infer<typeof CreateAccountIdentitySchema>) {
	const command = CreateAccountIdentitySchema.parse(input);
	command.names.sort((a, b) => a.language < b.language ? -1 : a.language > b.language ? 1 : 0);
	const digest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return runAccessTransaction(async tx => {
		const owner = await readPrivateAccountAuthority(tx, context, true);
		const [prior] = await tx.select().from(accountIdentityAdmission).where(and(
			eq(accountIdentityAdmission.authUserId, owner.principalId), eq(accountIdentityAdmission.operationId, command.operationId))).limit(1);
		if (prior) {
			if (prior.requestDigest !== digest) throw new AccessChanged();
			await requireAccessAdmission(tx, owner.admission);
			return receipt(prior);
		}
		const main = await captureIdentityPreference(tx, { authUserId: owner.principalId, clientId: null });
		if (main.mainVersion === 0 && command.main === null) throw new AccessInputInvalid();
		if (command.main && command.main.expectedVersion !== main.mainVersion) throw new AccessChanged();
		const entity = await createParticipantIdentity(tx, { shape: "person", operatorAuthUserId: owner.principalId, names: command.names });
		const grantId = crypto.randomUUID();
		const grant = await applyAccessRepresentationCommand(tx, { operation: "create", entityId: entity.id, grantId,
			operationId: command.operationId, expectedVersion: 0, operatorAuthUserId: owner.principalId, authoritySubjectId: owner.subjectId,
			recipient: { kind: "subject", subjectId: owner.subjectId }, parent: null,
			terms: { target: { kind: "all-scopes" }, validFrom: owner.credential.evaluatedAt, validUntil: null,
				canRedelegate: true, requireFreshSession: false, permissions: [...AccessPermissionValues], recipientEligibility: null },
		}, owner.admission);
		const admission = sql<boolean>`(${owner.admission}) and public.access_representation_is_current(${grantId}::uuid,${grant.termsRevision}::bigint) is true`;
		const selected = command.main ? await applyIdentityPreferenceCommand(tx, { authUserId: owner.principalId, clientId: null,
			operationId: command.operationId, expectedVersion: command.main.expectedVersion,
			operatorAuthUserId: owner.principalId, authoritySubjectId: owner.subjectId, selection: { kind: "entity", entityId: entity.id } }, admission) : null;
		const result = (await tx.execute<{ admitted: boolean | null; changed: string | null }>(sql`
			with admission as materialized(select (${admission}) as admitted),changed as (
			 insert into public.account_identity_admission(auth_user_id,operation_id,request_digest,entity_id,representation_id,main_preference_version)
			 select ${owner.principalId}::uuid,${command.operationId}::uuid,${digest},${entity.id}::uuid,${grantId}::uuid,${selected?.version ?? null}::bigint
			 where(select admitted from admission) is true returning operation_id
			) select(select admitted from admission) as admitted,(select operation_id from changed) as changed`)).rows[0];
		if (result?.admitted === false) throw new AccessDenied();
		if (result?.admitted !== true || !result.changed) throw new AccessUnavailable();
		return { operationId: command.operationId, entityId: entity.id,
			representation: { id: grantId, revision: grant.termsRevision }, mainPreferenceVersion: selected?.version ?? null };
	});
}

/** Erase at most 500 private creation receipts after account erasure; public identities and grants remain separate owners. @internal */
export async function eraseAccountIdentityAdmissionBatch(tx: DatabaseTransaction, principalId: string) {
	const [account] = await tx.select({ erasedAt: users.erasedAt }).from(users).where(eq(users.id, principalId)).for("no key update");
	if (!account?.erasedAt) throw new AccessDenied();
	const rows = await tx.select({ operationId: accountIdentityAdmission.operationId }).from(accountIdentityAdmission)
		.where(eq(accountIdentityAdmission.authUserId, principalId)).orderBy(accountIdentityAdmission.operationId).limit(500);
	if (!rows.length) return { deleted: 0, empty: true };
	const deleted = await tx.delete(accountIdentityAdmission).where(and(eq(accountIdentityAdmission.authUserId, principalId),
		inArray(accountIdentityAdmission.operationId, rows.map(row => row.operationId)))).returning({ operationId: accountIdentityAdmission.operationId });
	return { deleted: deleted.length, empty: false };
}
