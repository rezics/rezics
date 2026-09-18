import { createHash, createHmac } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { PrincipalRequestContext } from "../auth/principal-session";
import type { DatabaseTransaction } from "../database";
import { env } from "../config";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { accessImpactFence } from "@rezics/schema/postgres/access/access-group-impact";
import { accessGroupTree } from "@rezics/schema/postgres/access/access-group";
import { createPrivateRecipientSelectors } from "./recipient-selectors";
import { allocateAccessSubject, resolveAccessSubject } from "./identities";
import { readManagementAuthority } from "./management-authority";
import { scopeLifecycleAdmission } from "./scope-policy";
import { requireAccessAdmission, runAccessTransaction } from "./transaction";
import { readAccessSubjectEligibility } from "./subject-eligibility";
import { decryptOpaqueValue, encryptOpaqueValue } from "./opaque-values";
import {
	AccessChanged,
	AccessDenied,
	AccessInputInvalid,
	AccessRecordUnavailable,
	AccessUnavailable,
} from "./http-errors";

/** One credential/authority/root/purpose-bound subject codec for role assignments and ceilings. @internal */
export const assignmentRecipients = createPrivateRecipientSelectors(
	Buffer.from(env.BETTER_AUTH_SECRET),
);
/** Private mapping cannot be correlated across authority selections or credential contexts. @internal */
export function assignmentRecipientContext(context: PrincipalRequestContext, scopeId: string) {
	return {
		principalId: context.principalId,
		selection: context.selection,
		scopeId,
		purpose: "role-binding" as const,
		audience: createHash("sha256").update(JSON.stringify(context.credentialProof())).digest("hex"),
	};
}
/** Database wall clock used after waits, never a caller's timestamp. @internal */
export async function assignmentClock(tx: DatabaseTransaction) {
	const value = (await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`))
		.rows[0]?.now;
	const date = new Date(value ?? "invalid");
	if (!Number.isSafeInteger(date.getTime())) throw new AccessUnavailable();
	return date;
}
/** Present an already-disclosed private subject without its account/global subject identity. @internal */
export async function presentAssignmentSubject(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	subjectId: string,
) {
	const subject = await resolveAccessSubject(tx, subjectId);
	if (!subject) throw new AccessRecordUnavailable();
	const now = await assignmentClock(tx),
		bound = assignmentRecipientContext(context, scopeId);
	return {
		kind: subject.kind,
		recipient: assignmentRecipients.mint(subjectId, bound, now.getTime()),
		recipientKey: createHmac("sha256", env.BETTER_AUTH_SECRET)
			.update(JSON.stringify([bound, subjectId]))
			.digest("hex"),
		expiresAt: new Date(now.getTime() + 300000).toISOString(),
	};
}
/** Role assignment disclosure is itself scoped management and is rechecked before every response. @internal */
export async function assignmentAuthority(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	permission: "access.role-binding.manage" | "access.assignment-ceiling.manage",
	path: string[],
	mutation: boolean,
	exclude: { excludeBindingId?: string; excludeRoleId?: string } = {},
) {
	return readManagementAuthority(
		tx,
		{
			proof: context.credentialProof(),
			selection: context.selection,
			scopeId,
			path,
			permission,
			apiPermission: mutation ? "access:manage" : "access:read",
			requireFreshSession: mutation,
			mutation,
			...exclude,
		},
		await scopeLifecycleAdmission(tx, scopeId, mutation),
	);
}
/** Self or participating public Entity selection; never accepts another principal's raw ID. @internal */
export async function selectAssignmentRecipient(
	context: PrincipalRequestContext,
	scopeId: string,
	input: ({ kind: "self" } | { kind: "entity"; entityId: string }) & {
		management: "binding" | "ceiling";
		targetPath: string[];
	},
) {
	return runAccessTransaction(async (tx) => {
		const authority = await assignmentAuthority(
			tx,
			context,
			scopeId,
			input.management === "binding"
				? "access.role-binding.manage"
				: "access.assignment-ceiling.manage",
			input.targetPath,
			false,
		);
		if (input.kind === "entity") {
			const [entity] = await tx
				.select({ id: entityIdentity.id })
				.from(entityIdentity)
				.where(eq(entityIdentity.id, input.entityId))
				.for("share");
			if (!entity) throw new AccessRecordUnavailable();
		}
		const subjectId = await allocateAccessSubject(
			tx,
			input.kind === "self"
				? { kind: "principal", id: context.principalId }
				: { kind: "entity", id: input.entityId },
		);
		const [policy] = await readAccessSubjectEligibility(tx, {
			subjectIds: [subjectId],
			action: "read",
		});
		if (!policy || policy.outcome === "unavailable") throw new AccessUnavailable();
		if (policy.outcome !== "allow") {
			if (input.kind === "self") throw new AccessDenied();
			throw new AccessRecordUnavailable();
		}
		const result = await presentAssignmentSubject(tx, context, scopeId, subjectId);
		await requireAccessAdmission(
			tx,
			sql`(${authority.admission}) and public.access_subject_is_eligible(${subjectId}::uuid,'read') is true`,
		);
		return result;
	});
}
const settings = {
	secret: env.BETTER_AUTH_SECRET,
	keyContext: "assignment-recipient-page:v1",
	prefix: "rzar1.",
	maximumLength: 2048,
};
const cursorSchema = z.strictObject({
	afterSubject: z.uuid(),
	treeVersion: z.number().int().safe().nonnegative(),
	membershipEpoch: z.number().int().safe().nonnegative(),
	validUntil: z.number().int().safe(),
});
/** Enrollment candidates are keyset-paged before eligibility filtering, with an exact tree epoch across pages. @internal */
export async function listAssignmentRecipients(
	context: PrincipalRequestContext,
	scopeId: string,
	recipientScopeId: string,
	input: { cursor?: string; management: "binding" | "ceiling"; targetPath: string[] },
) {
	const { cursor } = input;
	return runAccessTransaction(async (tx) => {
		const manager = await assignmentAuthority(
			tx,
			context,
			scopeId,
			input.management === "binding"
				? "access.role-binding.manage"
				: "access.assignment-ceiling.manage",
			input.targetPath,
			false,
		);
		const disclosure = await readManagementAuthority(
			tx,
			{
				proof: context.credentialProof(),
				selection: context.selection,
				scopeId: recipientScopeId,
				path: ["memberships"],
				permission: "access.membership.read",
				apiPermission: "access:read",
				requireFreshSession: false,
				mutation: false,
			},
			await scopeLifecycleAdmission(tx, recipientScopeId, false),
		);
		const [tree] = await tx
			.select()
			.from(accessGroupTree)
			.where(eq(accessGroupTree.scopeId, recipientScopeId))
			.for("share");
		if (!tree) throw new AccessUnavailable();
		await tx
			.insert(accessImpactFence)
			.values({ kind: "tree", key: recipientScopeId })
			.onConflictDoNothing();
		const [epoch] = await tx
			.select()
			.from(accessImpactFence)
			.where(and(eq(accessImpactFence.kind, "tree"), eq(accessImpactFence.key, recipientScopeId)))
			.for("share");
		if (!epoch) throw new AccessUnavailable();
		const now = (await assignmentClock(tx)).getTime();
		const associated = Buffer.from(
			JSON.stringify([assignmentRecipientContext(context, scopeId), recipientScopeId]),
		);
		let after: z.infer<typeof cursorSchema> | null = null;
		if (cursor) {
			try {
				after = cursorSchema.parse(
					JSON.parse(decryptOpaqueValue(cursor, associated, settings).toString()),
				);
			} catch {
				throw new AccessInputInvalid();
			}
			if (
				after.treeVersion !== tree.version ||
				after.membershipEpoch !== epoch.version ||
				after.validUntil <= now
			)
				throw new AccessChanged();
		}
		const rows = await tx
			.select()
			.from(accessMembership)
			.where(
				and(
					eq(accessMembership.scopeId, recipientScopeId),
					after ? gt(accessMembership.subjectId, after.afterSubject) : undefined,
				),
			)
			.orderBy(accessMembership.subjectId)
			.limit(101);
		const items = [];
		for (const member of rows.slice(0, 100)) {
			const eligible = (
				await tx.execute<{ current: boolean | null }>(
					sql`select public.access_membership_is_eligible(${member.id}::uuid) as current`,
				)
			).rows[0]?.current;
			if (eligible === null || eligible === undefined) throw new AccessUnavailable();
			items.push({
				...(await presentAssignmentSubject(tx, context, scopeId, member.subjectId)),
				membershipVersion: member.version,
				generation: member.activeGeneration,
				eligible,
			});
		}
		const validUntil = after?.validUntil ?? now + 300000;
		await requireAccessAdmission(
			tx,
			sql`(${manager.admission}) and (${disclosure.admission}) and clock_timestamp()<${new Date(validUntil)}::timestamptz`,
		);
		return {
			items,
			treeVersion: tree.version,
			membershipEpoch: epoch.version,
			nextCursor:
				rows.length > 100
					? encryptOpaqueValue(
							Buffer.from(
								JSON.stringify({
									afterSubject: rows[99]!.subjectId,
									treeVersion: tree.version,
									membershipEpoch: epoch.version,
									validUntil,
								}),
							),
							associated,
							settings,
						)
					: null,
		};
	});
}
