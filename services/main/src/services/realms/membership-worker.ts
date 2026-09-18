import { createHash, randomUUID } from "node:crypto";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { realmEnforcement, realmEnrollmentOperation } from "@rezics/schema/postgres/realms/realm-enrollment";
import { presentEnrollment } from "./membership";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { database, type DatabaseTransaction } from "../database";
import {
	realmEnrollment,
	realmEnrollmentContact as contacts,
} from "@rezics/schema/postgres/realms/realm-enrollment";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { users } from "@rezics/schema/postgres/identity/auth";
import { AccessDenied } from "../authorization/http-errors";
import { lockOrganizationEnrollment } from "../participation/membership-policy";

async function recordSystemTransition(
	tx: DatabaseTransaction,
	row: typeof realmEnrollment.$inferSelect,
	operation: "expired" | "erased",
) {
	const [member] = await tx
		.select()
		.from(accessMembership)
		.where(eq(accessMembership.id, row.membershipId));
	const [restriction] = await tx
		.select()
		.from(realmEnforcement)
		.where(
			and(eq(realmEnforcement.scopeId, row.scopeId), eq(realmEnforcement.subjectId, row.subjectId)),
		);
	if (!member) throw new Error("Realm enrollment lost its shared identity");
	await tx.insert(realmEnrollmentOperation).values({
		scopeId: row.scopeId,
		subjectId: row.subjectId,
		operationId: randomUUID(),
		revision: row.revision,
		operatorAuthUserId: null,
		authoritySubjectId: null,
		operation,
		requestDigest: createHash("sha256")
			.update(
				JSON.stringify({
					operation,
					scopeId: row.scopeId,
					subjectId: row.subjectId,
					revision: row.revision,
				}),
			)
			.digest("hex"),
		result: presentEnrollment(row, member, restriction),
	});
}
/** Clear obsolete credential evidence in deadline-indexed batches; history and enforcement remain retained. @internal */
export async function expireRealmEnrollmentBatch() {
	return database.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(realmEnrollment)
			.where(
				sql`${realmEnrollment.consentExpiresAt} is not null and ${realmEnrollment.consentExpiresAt}<=clock_timestamp()`,
			)
			.orderBy(realmEnrollment.consentExpiresAt, realmEnrollment.scopeId, realmEnrollment.subjectId)
			.limit(50);
		const contactRows = await tx
			.select()
			.from(contacts)
			.where(sql`${contacts.revokedAt} is null and ${contacts.expiresAt}<=clock_timestamp()`)
			.orderBy(contacts.expiresAt, contacts.id)
			.limit(50)
			.for("update", { skipLocked: true });
		for (const contact of contactRows)
			await tx
				.update(contacts)
				.set({ revision: 2, revokedAt: new Date(), secretDigest: null })
				.where(eq(contacts.id, contact.id));
		let expired = 0;
		for (const candidate of rows) {
			await lockOrganizationEnrollment(tx, candidate.scopeId, candidate.subjectId);
			const [row] = await tx
				.select()
				.from(realmEnrollment)
				.where(
					and(
						eq(realmEnrollment.scopeId, candidate.scopeId),
						eq(realmEnrollment.subjectId, candidate.subjectId),
						sql`${realmEnrollment.consentExpiresAt}<=clock_timestamp()`,
					),
				)
				.for("update", { skipLocked: true });
			if (!row) continue;
			const [changed] = await tx
				.update(realmEnrollment)
				.set({
					consent: null,
					invitation: null,
					consentExpiresAt: null,
					state: row.state === "pending" || row.state === "invited" ? "rejected" : row.state,
					revision: row.revision + 1,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(realmEnrollment.scopeId, row.scopeId),
						eq(realmEnrollment.subjectId, row.subjectId),
					),
				)
				.returning();
			if (changed) await recordSystemTransition(tx, changed, "expired");
			expired++;
		}
		return { expired };
	});
}
/** After synchronous erasure and shared generation termination, purge only indexed private policy evidence. @internal */
export async function eraseRealmEnrollmentBatch(tx: DatabaseTransaction, authUserId: string) {
	const [account] = await tx.select().from(users).where(eq(users.id, authUserId)).for("share");
	if (!account?.erasedAt) throw new AccessDenied();
	const [subject] = await tx
		.select()
		.from(accessSubject)
		.where(eq(accessSubject.authUserId, authUserId));
	const ranges: SQL[] = [
		sql`${realmEnrollment.notificationBasis} is not null and ${realmEnrollment.notificationBasis}->>'principalId'=${authUserId}`,
		sql`${realmEnrollment.consent} is not null and ${realmEnrollment.consent}->>'principalId'=${authUserId}`,
		sql`${realmEnrollment.invitation} is not null and ${realmEnrollment.invitation}->>'principalId'=${authUserId}`,
	];
	if (subject)
		ranges.push(
			sql`${realmEnrollment.subjectId}=${subject.id}::uuid and ${realmEnrollment.state} in ('approved','pending','invited')`,
		);
	let deleted = 0;
	if (subject) {
		const contactRows = await tx
			.select()
			.from(contacts)
			.where(and(eq(contacts.subjectId, subject.id), sql`${contacts.revokedAt} is null`))
			.orderBy(contacts.id)
			.limit(20)
			.for("update", { skipLocked: true });
		for (const row of contactRows)
			await tx
				.update(contacts)
				.set({ revision: 2, revokedAt: new Date(), secretDigest: null })
				.where(eq(contacts.id, row.id));
		deleted += contactRows.length;
	}
	for (const range of ranges) {
		// LIMIT applies to each physical index range before overlap/dedup or policy evaluation.
		const rows = await tx
			.select()
			.from(realmEnrollment)
			.where(range)
			.orderBy(realmEnrollment.scopeId, realmEnrollment.subjectId)
			.limit(20);
		for (const candidate of rows) {
			await lockOrganizationEnrollment(tx, candidate.scopeId, candidate.subjectId);
			const [row] = await tx
				.select()
				.from(realmEnrollment)
				.where(
					and(
						eq(realmEnrollment.scopeId, candidate.scopeId),
						eq(realmEnrollment.subjectId, candidate.subjectId),
						range,
					),
				)
				.for("update");
			if (!row) continue;
			const own = row.subjectId === subject?.id;
			const [changed] = await tx
				.update(realmEnrollment)
				.set({
					notificationBasis: null,
					consent: null,
					invitation: null,
					consentExpiresAt: null,
					revision: row.revision + 1,
					updatedAt: new Date(),
					state: own
						? "removed"
						: row.state === "pending" || row.state === "invited"
							? "rejected"
							: row.state,
					generation: own ? null : row.generation,
				})
				.where(
					and(
						eq(realmEnrollment.scopeId, row.scopeId),
						eq(realmEnrollment.subjectId, row.subjectId),
					),
				)
				.returning();
			if (changed) await recordSystemTransition(tx, changed, "erased");
			deleted++;
		}
	}
	for (const range of ranges)
		if (
			(
				await tx
					.select({ id: realmEnrollment.subjectId })
					.from(realmEnrollment)
					.where(range)
					.limit(1)
			).length
		)
			return { deleted, empty: false };
	if (
		subject &&
		(
			await tx
				.select({ id: contacts.id })
				.from(contacts)
				.where(and(eq(contacts.subjectId, subject.id), sql`${contacts.revokedAt} is null`))
				.limit(1)
		).length
	)
		return { deleted, empty: false };
	return { deleted, empty: true };
}
