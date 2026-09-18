import { randomUUID } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { AccessManagementPermissionValues } from "@rezics/access";
import type { DatabaseTransaction } from "../database";
import { allocateAccessScope, allocateAccessSubject } from "../authorization/identities";
import { allocateReferenceValue } from "../units/reference-value";
import { applyAccessRepresentationCommand } from "../authorization/representations";
import { accessRepresentation } from "@rezics/schema/postgres/access/access-representation";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";
import { requireAccessAdmission } from "../authorization/transaction";
import { AccessUnavailable } from "../authorization/http-errors";

/**
 * Native institutional governance issued only inside new-identity creation or admitted recovery.
 * @internal
 * @remarks This explicit relation is not derived from Org enrollment, sourced affiliation,
 * directory metadata ownership or a user's Self. Existing retained data is not migrated.
 */
export async function establishOrganizationEnrollmentControl(
	tx: DatabaseTransaction,
	input: {
		entityId: string;
		recipientAuthUserId: string;
		operatorAuthUserId: string;
		operationId?: string;
		recover?: boolean;
		authoritySubjectId?: string;
	},
	admission: SQL<boolean | null>,
) {
	const [entity] = await tx
		.select()
		.from(entityIdentity)
		.where(eq(entityIdentity.id, input.entityId))
		.for("share");
	if (entity?.shape !== "organization") return null;
	const scopeId = await allocateAccessScope(tx, {
		kind: "resource",
		referenceValueId: await allocateReferenceValue(tx, { owner: "entity", id: input.entityId }),
	});
	const recipient = await allocateAccessSubject(tx, {
		kind: "principal",
		id: input.recipientAuthUserId,
	});
	const actor =
		input.authoritySubjectId ??
		(await allocateAccessSubject(tx, { kind: "principal", id: input.operatorAuthUserId }));
	if (input.recover) {
		// Recovery closes prior native root grants. Child grants lose their lineage without a recursive rewrite.
		const roots = await tx
			.select()
			.from(accessRepresentation)
			.where(
				and(
					eq(accessRepresentation.entityId, input.entityId),
					eq(accessRepresentation.state, "active"),
				),
			)
			.orderBy(accessRepresentation.id)
			.limit(257);
		if (roots.length > 256) throw new AccessUnavailable();
		for (const root of roots)
			if (!root.parentGrantId)
				await applyAccessRepresentationCommand(
					tx,
					{
						operation: "revoke",
						entityId: input.entityId,
						grantId: root.id,
						operationId: randomUUID(),
						expectedVersion: root.version,
						operatorAuthUserId: input.operatorAuthUserId,
						authoritySubjectId: actor,
					},
					admission,
				);
	}
	const now = new Date(
		(await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`)).rows[0]!.now,
	);
	const grant = await applyAccessRepresentationCommand(
		tx,
		{
			operation: "create",
			entityId: input.entityId,
			grantId: randomUUID(),
			expectedVersion: 0,
			operationId: input.operationId ?? randomUUID(),
			operatorAuthUserId: input.operatorAuthUserId,
			authoritySubjectId: actor,
			recipient: { kind: "subject", subjectId: recipient },
			parent: null,
			terms: {
				target: { kind: "scope", scopeId, path: [] },
				validFrom: now,
				validUntil: null,
				canRedelegate: true,
				requireFreshSession: false,
				permissions: AccessManagementPermissionValues.filter(
					(key) => key.startsWith("access.") && key !== "access.membership.recover",
				).map((key) => ({ family: "management" as const, key })),
				recipientEligibility: null,
			},
		},
		admission,
	);
	await requireAccessAdmission(tx, admission);
	return { scopeId, representation: { id: grant.grantId, revision: grant.termsRevision } };
}

/** Newly created Org governance is available to private accounts without creating a public Self. @alpha */
export async function createNativeOrganization(
	context: import("../auth/principal-session").PrincipalRequestContext,
	input: { name: string; language: string },
) {
	const { runAccessTransaction } = await import("../authorization/transaction");
	const { readPrivateAccountAuthority } = await import(
		"../authorization/private-account-authority"
	);
	const { createParticipantIdentity } = await import("./identity");
	const { CreateManagedOrganizationSchema } = await import("./organizations");
	const { parseContentLanguageTag } = await import("@rezics/content-language");
	const value = CreateManagedOrganizationSchema.parse(input);
	return runAccessTransaction(async (tx) => {
		const actor = await readPrivateAccountAuthority(tx, context, true);
		const entity = await createParticipantIdentity(tx, {
			shape: "organization",
			operatorAuthUserId: actor.principalId,
			names: [{ language: parseContentLanguageTag(value.language).tag, value: value.name }],
		});
		const native = await establishOrganizationEnrollmentControl(
			tx,
			{
				entityId: entity.id,
				recipientAuthUserId: actor.principalId,
				operatorAuthUserId: actor.principalId,
			},
			actor.admission,
		);
		if (!native) throw new AccessUnavailable();
		return { entityId: entity.id, ...native };
	});
}
