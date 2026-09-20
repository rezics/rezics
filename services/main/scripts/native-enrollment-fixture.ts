import { sessions } from "@rezics/schema/postgres/identity/auth";
import { randomBytes, randomUUID } from "node:crypto";
import type { AccessPermission } from "@rezics/access";
import type { UnitReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../src/services/database";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import {
	captureSessionCredentialProof,
	readFirstPartyCredentialAuthority,
} from "../src/services/auth/credential-authority";
import {
	allocateAccessScope,
	allocateAccessSubject,
} from "../src/services/authorization/identities";
import { allocateReferenceValue } from "../src/services/units/reference-value";
import { applyAccessRoleCommand } from "../src/services/authorization/roles";
import { applyAccessRoleBindingCommand } from "../src/services/authorization/role-bindings";

type FixtureSession = { id: string; userId: string; token: string };

/** Fixture bootstrap is deliberately SQL-admin setup, never a product grant-issuance endpoint. @internal */
export function assertNativeEnrollmentFixture() {
	const value = process.env.DATABASE_URL ?? process.env.DATABASE_ADMIN_URL;
	if (!value || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
		throw new Error("Native enrollment setup requires an explicit disposable target");
	const target = new URL(value);
	if (
		!["postgres:", "postgresql:"].includes(target.protocol) ||
		!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
		target.port === "15432" ||
		!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
	)
		throw new Error("Native enrollment setup requires an isolated loopback Atlas target");
}

/** Capture a real stored fixture session, then let every domain command revalidate it. @internal */
export function fixturePrincipalContext(session: FixtureSession) {
	assertNativeEnrollmentFixture();
	return new PrincipalRequestContext(
		session.userId,
		{ mode: "direct" },
		captureSessionCredentialProof(session),
	);
}

/** Create an actual disposable session for storage fixtures that previously supplied unproved actor objects. @internal */
export async function createFixtureSessionContext(tx: DatabaseTransaction, authUserId: string) {
	assertNativeEnrollmentFixture();
	const [session] = await tx
		.insert(sessions)
		.values({
			userId: authUserId,
			token: randomBytes(32).toString("base64url"),
			expiresAt: new Date(Date.now() + 3_600_000),
		})
		.returning();
	if (!session) throw new Error("Fixture session creation failed");
	return fixturePrincipalContext(session);
}

const membershipPermissions: AccessPermission[] = [
	{ family: "management", key: "access.membership.read" },
	{ family: "management", key: "access.membership.manage" },
	{ family: "management", key: "access.membership.participate" },
];

/** Install an explicit native role/binding for a direct fixture principal at one resource root. @internal */
export async function fixtureMembershipManager(
	tx: DatabaseTransaction,
	session: FixtureSession,
	reference: UnitReference,
) {
	assertNativeEnrollmentFixture();
	const proof = captureSessionCredentialProof(session);
	const credential = await readFirstPartyCredentialAuthority(tx, {
		proof,
		selection: { mode: "direct" },
		apiPermission: "access:manage",
		requireFreshSession: true,
		requireVerifiedEmail: true,
	});
	const scopeId = await allocateAccessScope(tx, {
		kind: "resource",
		referenceValueId: await allocateReferenceValue(tx, reference),
	});
	const subjectId = await allocateAccessSubject(tx, { kind: "principal", id: session.userId });
	const actor = { operatorAuthUserId: session.userId, authoritySubjectId: subjectId };
	const roleId = randomUUID();
	const role = await applyAccessRoleCommand(
		tx,
		{
			operation: "create",
			scopeId,
			roleId,
			expectedVersion: 0,
			operationId: randomUUID(),
			...actor,
			definition: {
				label: "Fixture membership manager",
				description: null,
				permissions: membershipPermissions,
			},
		},
		credential.admission,
	);
	if (role.definitionRevision === null)
		throw new Error("Fixture role lacks an authored definition");
	await applyAccessRoleCommand(
		tx,
		{
			operation: "activate",
			scopeId,
			roleId,
			expectedVersion: role.version,
			definitionRevision: role.definitionRevision,
			operationId: randomUUID(),
			...actor,
		},
		credential.admission,
	);
	const binding = await applyAccessRoleBindingCommand(
		tx,
		{
			operation: "create",
			targetScopeId: scopeId,
			bindingId: randomUUID(),
			roleId,
			recipient: { kind: "subject", subjectId },
			expectedVersion: 0,
			operationId: randomUUID(),
			...actor,
			terms: {
				targetPath: ["memberships"],
				validFrom: new Date(Date.now() - 1000),
				validUntil: null,
				recipientEligibility: null,
				permissionPolicy: { mode: "local-role" },
			},
		},
		credential.admission,
	);
	return { scopeId, roleId, binding, actor, context: fixturePrincipalContext(session) };
}
