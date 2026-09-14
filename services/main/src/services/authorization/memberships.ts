import { createHash } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { accessGroupTree } from "../database/schema/access-group";
import {
	accessMembership,
	accessMembershipAdmission,
	accessMembershipEvent,
} from "../database/schema/access-membership";

/** Captured scope, member, precondition and private audit context for one owner-authorized transition. @internal */
export interface AccessMembershipCommand {
	scopeId: string;
	subjectId: string;
	expectedVersion: number;
	operationId: string;
	operatorAuthUserId: string;
	authoritySubjectId: string;
	operation: "admit" | "leave" | "remove";
}
/** Original command result; later rejoin or departure does not rewrite this receipt. @internal */
export interface AccessMembershipReceipt {
	membershipId: string;
	operationId: string;
	version: number;
	lastGeneration: number;
	activeGeneration: number | null;
}
/** The requested membership transition or operation identity conflicts with current state. @internal */
export class AccessMembershipConflict extends Error {
	constructor() {
		super("Membership command conflicts with its state or operation receipt");
	}
}
/** Current owner admission denied the effect. @internal */
export class AccessMembershipAdmissionDenied extends Error {
	constructor() {
		super("Current membership authority and admission are required");
	}
}
/** Missing authority is preserved independently from a known denial. @internal */
export class AccessMembershipAdmissionUnavailable extends Error {
	constructor() {
		super("Membership admission is unavailable");
	}
}
const schema = z.strictObject({
	scopeId: z.uuid(),
	subjectId: z.uuid(),
	expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
	operationId: z.uuid(),
	operatorAuthUserId: z.uuid(),
	authoritySubjectId: z.uuid(),
	operation: z.enum(["admit", "leave", "remove"]),
});
function requireAdmission(value: boolean | null | undefined) {
	if (value === false) throw new AccessMembershipAdmissionDenied();
	if (value !== true) throw new AccessMembershipAdmissionUnavailable();
}
function receipt(event: typeof accessMembershipEvent.$inferSelect): AccessMembershipReceipt {
	return {
		membershipId: event.membershipId,
		operationId: event.operationId,
		version: event.version,
		lastGeneration: event.lastGeneration,
		activeGeneration: event.activeGeneration,
	};
}

/**
 * Apply a generation-bound membership transition in a rollback-safe savepoint.
 * @internal
 * @remarks The owner supplies a side-effect-free SQL predicate after complete
 * authority-fence locking. It includes actor/subject eligibility, consent, rules,
 * invitation state and independent restrictions as applicable. This primitive
 * does not infer them from identity or audit fields. Admission is checked before
 * changes, after lock waits and in the final head write; receipts do not bypass it.
 */
export async function applyAccessMembershipCommand(
	tx: DatabaseTransaction,
	input: AccessMembershipCommand,
	admission: SQL<boolean | null>,
): Promise<AccessMembershipReceipt> {
	const command = schema.parse(input),
		requestDigest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
	return tx.transaction(async (work) => {
		const authorize = async () =>
			requireAdmission(
				(await work.execute<{ admitted: boolean | null }>(sql`select (${admission}) as admitted`))
					.rows[0]?.admitted,
			);
		await authorize();
		if (command.operation === "admit")
			await work.insert(accessGroupTree).values({ scopeId: command.scopeId }).onConflictDoNothing();
		const [tree] = await work
			.select({ scopeId: accessGroupTree.scopeId })
			.from(accessGroupTree)
			.where(eq(accessGroupTree.scopeId, command.scopeId))
			.for("share");
		if (!tree) throw new AccessMembershipAdmissionUnavailable();
		await authorize();
		const load = async () =>
			(
				await work
					.select()
					.from(accessMembership)
					.where(
						and(
							eq(accessMembership.scopeId, command.scopeId),
							eq(accessMembership.subjectId, command.subjectId),
						),
					)
					.limit(1)
					.for("update")
			)[0];
		let head = await load();
		if (!head && command.operation === "admit") {
			await authorize();
			await work
				.insert(accessMembership)
				.values({ scopeId: command.scopeId, subjectId: command.subjectId })
				.onConflictDoNothing({ target: [accessMembership.scopeId, accessMembership.subjectId] });
			head = await load();
		}
		if (!head) throw new AccessMembershipConflict();
		await authorize();
		const [prior] = await work
			.select()
			.from(accessMembershipEvent)
			.where(
				and(
					eq(accessMembershipEvent.membershipId, head.id),
					eq(accessMembershipEvent.operationId, command.operationId),
				),
			)
			.limit(1);
		if (prior) {
			if (
				prior.requestDigest !== requestDigest ||
				prior.operatorAuthUserId !== command.operatorAuthUserId ||
				prior.authoritySubjectId !== command.authoritySubjectId
			)
				throw new AccessMembershipConflict();
			return receipt(prior);
		}
		if (
			head.version !== command.expectedVersion ||
			(command.operation === "admit") !== (head.activeGeneration === null)
		)
			throw new AccessMembershipConflict();
		const version = head.version + 1,
			lastGeneration =
				command.operation === "admit" ? head.lastGeneration + 1 : head.lastGeneration,
			activeGeneration = command.operation === "admit" ? lastGeneration : null;
		const [event] = await work
			.insert(accessMembershipEvent)
			.values({
				membershipId: head.id,
				version,
				operationId: command.operationId,
				requestDigest,
				operation: command.operation,
				lastGeneration,
				activeGeneration,
				operatorAuthUserId: command.operatorAuthUserId,
				authoritySubjectId: command.authoritySubjectId,
			})
			.returning();
		if (!event) throw Error("Membership receipt was not written");
		if (command.operation === "admit")
			await work
				.insert(accessMembershipAdmission)
				.values({ membershipId: head.id, generation: lastGeneration, eventVersion: version });
		const result = await work.execute<{ admitted: boolean | null; changed: string | null }>(sql`
		 with admission as materialized(select (${admission}) as admitted),changed as(
		 update public.access_membership set version=${version},last_generation=${lastGeneration},active_generation=${activeGeneration}
		 where id=${head.id}::uuid and version=${head.version} and(select admitted from admission) is true returning id
		 ) select(select admitted from admission) as admitted,(select id from changed) as changed`);
		requireAdmission(result.rows[0]?.admitted);
		if (!result.rows[0]?.changed) throw new AccessMembershipConflict();
		return receipt(event);
	});
}

/** Read the exact scope/subject head. Its active flag alone does not prove current eligibility, consent or permission. @internal */
export async function readAccessMembership(
	tx: DatabaseTransaction,
	input: { scopeId: string; subjectId: string },
) {
	z.uuid().parse(input.scopeId);
	z.uuid().parse(input.subjectId);
	const [head] = await tx
		.select()
		.from(accessMembership)
		.where(
			and(
				eq(accessMembership.scopeId, input.scopeId),
				eq(accessMembership.subjectId, input.subjectId),
			),
		)
		.limit(1);
	return head ?? null;
}
