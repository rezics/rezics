import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import type { PrincipalRequestContext } from "../auth/principal-context";
import { realmEnrollmentContact as contacts } from "@rezics/schema/postgres/realms/realm-enrollment";
import {
	enrollmentSubjectAuthority,
	membershipRecipientContext,
	membershipRecipients,
	realmEnrollmentScope,
	realmMembershipAuthority,
} from "./membership-policy";
import { requireAccessAdmission } from "../authorization/transaction";
import {
	AccessChanged,
	AccessDenied,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "../authorization/http-errors";
import { enrollmentClock } from "./membership";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
/** Consenting private principals name a Realm address without probing its existence or exposing their account. @alpha */
export async function createRealmEnrollmentContact(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	requestedRealmId: string,
) {
	if (context.selection.mode !== "direct") throw new AccessDenied();
	const actor = await enrollmentSubjectAuthority(tx, context, true);
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`realm-contact:${actor.subjectId}`},0))`,
	);
	const rows = await tx
		.select({ id: contacts.id })
		.from(contacts)
		.where(and(eq(contacts.subjectId, actor.subjectId), sql`${contacts.revokedAt} is null`))
		.orderBy(contacts.id)
		.limit(65);
	if (rows.length >= 64) throw new AccessUnavailable();
	const secret = randomBytes(32).toString("base64url"),
		now = await enrollmentClock(tx);
	const [row] = await tx
		.insert(contacts)
		.values({
			requestedRealmId,
			subjectId: actor.subjectId,
			secretDigest: digest(secret),
			expiresAt: new Date(now.getTime() + 29 * 86400000),
		})
		.returning();
	if (!row) throw new AccessUnavailable();
	await requireAccessAdmission(tx, actor.admission);
	return {
		id: row.id,
		revision: row.revision,
		contact: secret,
		expiresAt: row.expiresAt.toISOString(),
	};
}
/** Only this Realm's native managers can exchange consent for a purpose/credential-bound recipient. @alpha */
export async function resolveRealmEnrollmentContact(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	secret: string,
) {
	const scope = await realmEnrollmentScope(tx, realmId, false),
		manager = await realmMembershipAuthority(tx, context, scope, true, false);
	const [row] = await tx
		.select()
		.from(contacts)
		.where(eq(contacts.secretDigest, digest(secret)))
		.for("share");
	if (!row || row.requestedRealmId !== realmId) throw new AccessRecordUnavailable();
	const now = await enrollmentClock(tx);
	await requireAccessAdmission(
		tx,
		sql<boolean>`(${manager.admission}) and ${row.revokedAt === null} and clock_timestamp()<${row.expiresAt}::timestamptz and public.access_subject_is_eligible(${row.subjectId}::uuid,'write')`,
	);
	return {
		contactId: row.id,
		recipient: {
			kind: "principal" as const,
			selector: membershipRecipients.mint(
				row.subjectId,
				membershipRecipientContext(context, scope.scopeId),
				now.getTime(),
			),
		},
	};
}
/** Revocation ends consent even when the addressed Realm is closed or nonexistent. @alpha */
export async function revokeRealmEnrollmentContact(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	id: string,
	expectedRevision: number,
) {
	const actor = await enrollmentSubjectAuthority(tx, context, true);
	const [row] = await tx
		.select()
		.from(contacts)
		.where(and(eq(contacts.id, id), eq(contacts.subjectId, actor.subjectId)))
		.for("update");
	if (!row) throw new AccessRecordUnavailable();
	if (row.revision !== expectedRevision) throw new AccessChanged();
	if (row.revokedAt === null)
		await tx
			.update(contacts)
			.set({ revision: 2, revokedAt: await enrollmentClock(tx), secretDigest: null })
			.where(eq(contacts.id, id));
	await requireAccessAdmission(tx, actor.admission);
	return { id, revision: 2 };
}
