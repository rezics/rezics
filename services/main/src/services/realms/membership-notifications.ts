import { evaluateCurrentRepresentationAuthority } from "../authorization/representation-authority";
import { allocateReferenceValue } from "../units/reference-value";
import { AccessUnavailable } from "../authorization/http-errors";
import { sql, type SQL } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import type { RealmEnrollmentNotificationBasis } from "../database/schema/realm-enrollment";
import { allocateAccessSubject, allocateAccessScope } from "../authorization/identities";
import { createNotification } from "../notifications/service";
/** Retained consent routes a notice to one exact private inbox, never an inferred controller roster. @internal */
export async function notifyRealmEnrollment(
	tx: DatabaseTransaction,
	input: {
		realmId: string;
		operationId: string;
		actorEntityId: string | null;
		recipient: { kind: "principal" | "entity"; id: string };
		basis: RealmEnrollmentNotificationBasis | null;
	},
) {
	let principalId: string;
	let eligibility: SQL<boolean | null>;
	if (input.recipient.kind === "principal") {
		principalId = input.recipient.id;
		eligibility = sql<boolean>`public.access_principal_account_is_eligible(${principalId}::uuid,'read')`;
	} else {
		if (
			!input.basis ||
			input.basis.selection.mode !== "represented" ||
			input.basis.selection.entityId !== input.recipient.id
		)
			return;
		principalId = input.basis.principalId;
		const subjectId = await allocateAccessSubject(tx, { kind: "principal", id: principalId });
		const scopeId = await allocateAccessScope(tx, {
			kind: "resource",
			referenceValueId: await allocateReferenceValue(tx, {
				owner: "entity",
				id: input.recipient.id,
			}),
		});
		// Receiving a consented notice is not a new authenticated representation request; no fresh-session fact is asserted.
		const current = await evaluateCurrentRepresentationAuthority(tx, {
			principalId,
			selection: input.basis.selection,
			operation: {
				scopeId,
				path: ["memberships"],
				permission: { family: "management", key: "access.membership.participate" },
			},
			action: "read",
			freshSession: false,
		});
		if (current.outcome === "unavailable") throw new AccessUnavailable();
		if (current.outcome !== "allow") return;
		eligibility = sql<boolean>`public.access_representation_path_is_current(array[${sql.join(
			input.basis.selection.representations.map((value) => sql`${value.id}::uuid`),
			sql`, `,
		)}],array[${sql.join(
			input.basis.selection.representations.map((value) => sql`${value.revision}::bigint`),
			sql`, `,
		)}],${subjectId}::uuid,${input.recipient.id}::uuid,'read')`;
	}
	// Notices contain only the Realm/event reference; the destination is the explicit enrollment consenter.
	const [allowed] = (
		await tx.execute<{ allowed: boolean | null }>(sql`select (${eligibility}) as allowed`)
	).rows;
	if (allowed?.allowed == null) throw new AccessUnavailable();
	if (!allowed.allowed) return;
	await createNotification(tx, {
		recipientAuthUserId: principalId,
		kind: "realm",
		actorProfileId: input.actorEntityId,
		subjectUnitId: input.realmId,
		payload: { type: "realm_event", event: "membership_updated" },
		dedupeKey: `realm-enrollment:${input.operationId}:${principalId}`,
	});
	// A revoked delivery basis must not enqueue a notice after the final clock read.
	const [current] = (
		await tx.execute<{ allowed: boolean | null }>(sql`select (${eligibility}) as allowed`)
	).rows;
	if (current?.allowed !== true) throw new AccessUnavailable();
}
