import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/schema/postgres/shared/contract-values";
import { sessions } from "@rezics/schema/postgres/identity/auth";
import { realm } from "@rezics/schema/postgres/realms/realm";
import { PrincipalRequestContext } from "../auth/principal-context";
import { captureSessionCredentialProof } from "../auth/credential-authority";
import { createAccountIdentity } from "../authorization/create-account-identity";
import { withDatabaseTransactionContext, type DatabaseTransaction } from "../database";
import { acknowledgeRealmRules, joinRealm, updateRealmMember } from "../realms/membership";

/** Synthetic actors retain real private credential and explicit public representation proof. @internal */
export async function createSeedParticipant(
	tx: DatabaseTransaction,
	authUserId: string,
	name: { language: ContentLanguage; value: string },
) {
	const [session] = await tx
		.insert(sessions)
		.values({
			userId: authUserId,
			token: randomBytes(32).toString("base64url"),
			expiresAt: new Date(Date.now() + 7 * 86400000),
		})
		.returning();
	if (!session) throw new Error("Seed session creation failed");
	const proof = captureSessionCredentialProof(session),
		direct = new PrincipalRequestContext(authUserId, { mode: "direct" }, proof);
	const identity = await withDatabaseTransactionContext(tx, () =>
		createAccountIdentity(direct, {
			operationId: randomUUID(),
			names: [name],
			main: { expectedVersion: 0 },
		}),
	);
	return {
		id: identity.entityId,
		context: new PrincipalRequestContext(
			authUserId,
			{
				mode: "represented",
				entityId: identity.entityId,
				representations: [identity.representation],
			},
			proof,
		),
	};
}

/**
 * Materialize a declared synthetic participation scenario through the production consent protocol.
 * @internal
 * @remarks Called only after the empty local seed target is admitted. Current policy,
 * credentials and exact operation receipts remain enforced; reference-time copy is not
 * a forged authentication timestamp. Pending scenarios require approval policy.
 */
export async function seedRealmEnrollment(
	tx: DatabaseTransaction,
	input: {
		realmId: string;
		context: PrincipalRequestContext;
		manager?: PrincipalRequestContext;
		state: "active" | "pending" | "muted";
		rule?: { id: string; language: ContentLanguage };
	},
) {
	const [record] = await tx.select().from(realm).where(eq(realm.id, input.realmId));
	if (!record) throw new Error("Seed Realm is missing");
	if (input.context.selection.mode !== "represented")
		throw new Error("Public seed enrollment requires an explicit Entity");
	if (input.state === "pending" && record.joinPolicy !== "approval")
		throw new Error("Pending seed enrollment requires approval policy");
	let receipt: Awaited<ReturnType<typeof joinRealm>> | undefined;
	const expected = () => ({
		operationId: randomUUID(),
		expectedControlRevision: record.membershipControlRevision,
		expectedRevision: receipt?.revision ?? 0,
		expectedMembershipVersion: receipt?.version ?? 0,
		expectedEnforcementRevision: receipt?.enforcementRevision ?? 0,
	});
	if (input.rule)
		receipt = await acknowledgeRealmRules(tx, input.context, input.realmId, input.rule.id, {
			...expected(),
			consent: true,
			language: input.rule.language,
		});
	receipt = await joinRealm(tx, input.context, input.realmId, {
		...expected(),
		consent: true,
		ruleRevisionId: input.rule?.id ?? null,
	});
	if (receipt.state === "pending" && input.state !== "pending") {
		if (!input.manager) throw new Error("Seed approval requires its actual Realm manager");
		receipt = await updateRealmMember(tx, input.manager, input.realmId, {
			...expected(),
			operation: "approve",
			recipient: { kind: "entity", entityId: input.context.selection.entityId },
		});
	}
	if (input.state === "muted") {
		if (!input.manager) throw new Error("Seed mute requires its actual Realm manager");
		receipt = await updateRealmMember(tx, input.manager, input.realmId, {
			...expected(),
			operation: "mute",
			recipient: { kind: "entity", entityId: input.context.selection.entityId },
		});
	}
	if ((input.state === "pending") !== (receipt.activeGeneration === null))
		throw new Error("Seed enrollment did not produce the declared admission state");
	return receipt;
}
