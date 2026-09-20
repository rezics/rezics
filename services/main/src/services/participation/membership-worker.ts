import { organizationInvitationAvailability } from "./membership";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { database } from "../database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { accessSubject } from "@rezics/schema/postgres/access/access-identity";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import {
	organizationEnrollmentInvitation as invitations,
	organizationEnrollmentOperation as operations,
	organizationEnrollmentContact as contacts,
	organizationEnrollmentReview as reviews,
} from "@rezics/schema/postgres/access/organization-membership";
import { applyAccessMembershipCommand } from "../authorization/memberships";
import { AccessDenied } from "../authorization/http-errors";
import { lockOrganizationEnrollment } from "./membership-policy";
/** Bounded erasure clears admission before deleting private invitation/contact data; native audit anchors are retained. @internal */
export async function eraseOrganizationEnrollmentBatch(
	tx: DatabaseTransaction,
	authUserId: string,
	stage: "receipts" | "memberships" | "invitations",
) {
	const [account] = await tx.select().from(users).where(eq(users.id, authUserId)).for("share");
	if (!account?.erasedAt) throw new AccessDenied();
	const [subject] = await tx
		.select()
		.from(accessSubject)
		.where(eq(accessSubject.authUserId, authUserId));
	if (!subject) return { deleted: 0, empty: true };
	if (stage === "receipts") {
		const rows = await tx
			.select()
			.from(operations)
			.where(eq(operations.recipientSubjectId, subject.id))
			.orderBy(operations.operationId)
			.limit(100)
			.for("update", { skipLocked: true });
		for (const row of rows)
			await tx
				.delete(operations)
				.where(
					and(eq(operations.scopeId, row.scopeId), eq(operations.operationId, row.operationId)),
				);
		const [remaining] = await tx
			.select({ id: operations.operationId })
			.from(operations)
			.where(eq(operations.recipientSubjectId, subject.id))
			.limit(1);
		return { deleted: rows.length, empty: !remaining };
	}
	if (stage === "memberships") {
		// Partial subject/active-scope index excludes unbounded departed history before LIMIT.
		const rows = await tx
			.select()
			.from(accessMembership)
			.where(
				and(
					eq(accessMembership.subjectId, subject.id),
					sql`${accessMembership.activeGeneration} is not null`,
				),
			)
			.orderBy(accessMembership.scopeId)
			.limit(20);
		for (const row of rows) {
			await lockOrganizationEnrollment(tx, row.scopeId, row.subjectId);
			const [current] = await tx
				.select()
				.from(accessMembership)
				.where(eq(accessMembership.id, row.id))
				.for("update");
			if (current?.activeGeneration === null || !current) continue;
			// Erasure is an irreversible owner policy, so it cannot require the erased actor's live session or vetoable consent.
			await applyAccessMembershipCommand(
				tx,
				{
					scopeId: row.scopeId,
					subjectId: row.subjectId,
					operation: "remove",
					expectedVersion: current.version,
					operationId: randomUUID(),
					operatorAuthUserId: authUserId,
					authoritySubjectId: subject.id,
				},
				sql`exists(select 1 from public.users where id=${authUserId}::uuid and erased_at is not null)`,
			);
		}
		const [remaining] = await tx
			.select({ id: accessMembership.id })
			.from(accessMembership)
			.where(
				and(
					eq(accessMembership.subjectId, subject.id),
					sql`${accessMembership.activeGeneration} is not null`,
				),
			)
			.limit(1);
		return { deleted: rows.length, empty: !remaining };
	}
	const rows = await tx
		.select()
		.from(invitations)
		.where(eq(invitations.recipientSubjectId, subject.id))
		.orderBy(invitations.id)
		.limit(100)
		.for("update", { skipLocked: true });
	if (rows.length)
		await tx.delete(invitations).where(
			inArray(
				invitations.id,
				rows.map((row) => row.id),
			),
		);
	const [remaining] = await tx
		.select({ id: invitations.id })
		.from(invitations)
		.where(eq(invitations.recipientSubjectId, subject.id))
		.limit(1);
	if (remaining) return { deleted: rows.length, empty: false };
	const links = await tx
		.select()
		.from(contacts)
		.where(eq(contacts.subjectId, subject.id))
		.orderBy(contacts.id)
		.limit(64);
	if (links.length)
		await tx.delete(contacts).where(
			inArray(
				contacts.id,
				links.map((row) => row.id),
			),
		);
	return { deleted: rows.length + links.length, empty: true };
}
/** Expiry work starts at a deadline index, never a corpus-wide pending filter. @internal */
export async function expireOrganizationEnrollmentBatch() {
	return database.transaction(async (tx) => {
		const now = new Date();
		const rows = await tx
			.select()
			.from(invitations)
			.where(and(eq(invitations.state, "pending"), sql`${invitations.expiresAt}<=${now}`))
			.orderBy(invitations.expiresAt, invitations.id)
			.limit(100)
			.for("update", { skipLocked: true });
		if (rows.length)
			await tx
				.update(invitations)
				.set({
					state: "expired",
					revision: sql`${invitations.revision}+1`,
					resolvedAt: now,
					authority: null,
				})
				.where(
					inArray(
						invitations.id,
						rows.map((row) => row.id),
					),
				);
		const links = await tx
			.select()
			.from(contacts)
			.where(and(isNull(contacts.revokedAt), sql`${contacts.expiresAt}<=${now}`))
			.orderBy(contacts.expiresAt, contacts.id)
			.limit(100)
			.for("update", { skipLocked: true });
		if (links.length)
			await tx
				.update(contacts)
				.set({ revokedAt: now, version: 2 })
				.where(
					inArray(
						contacts.id,
						links.map((row) => row.id),
					),
				);
		return { expiredInvitations: rows.length, expiredContacts: links.length };
	});
}

/** Reconcile only due indexed candidates; permission revocation is already immediate on every acceptance. @internal */
export async function reconcileOrganizationEnrollmentBatch() {
	const candidates = await database
		.select({ id: reviews.invitationId })
		.from(reviews)
		.where(sql`${reviews.dueAt}<=clock_timestamp()`)
		.orderBy(reviews.dueAt, reviews.invitationId)
		.limit(20);
	let resolved = 0,
		unavailable = 0;
	for (const candidate of candidates)
		await database.transaction(async (tx) => {
			const [hint] = await tx.select().from(invitations).where(eq(invitations.id, candidate.id));
			if (!hint) return;
			await lockOrganizationEnrollment(tx, hint.scopeId);
			const [queue] = await tx
				.select()
				.from(reviews)
				.where(eq(reviews.invitationId, candidate.id))
				.for("update", { skipLocked: true });
			if (!queue) return;
			const [row] = await tx
				.select()
				.from(invitations)
				.where(eq(invitations.id, candidate.id))
				.for("update");
			if (!row || row.state !== "pending") {
				await tx.delete(reviews).where(eq(reviews.invitationId, candidate.id));
				return;
			}
			const outcome = await organizationInvitationAvailability(tx, row);
			if (outcome === "deny") {
				await tx
					.update(invitations)
					.set({
						state: row.expiresAt <= new Date() ? "expired" : "invalidated",
						revision: row.revision + 1,
						resolvedAt: new Date(),
						authority: null,
					})
					.where(eq(invitations.id, row.id));
				resolved++;
			} else {
				if (outcome === "unavailable") unavailable++;
				await tx
					.update(reviews)
					.set({ dueAt: new Date(Date.now() + 300000) })
					.where(eq(reviews.invitationId, candidate.id));
			}
		});
	return { examined: candidates.length, resolved, unavailable };
}
