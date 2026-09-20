import { getPublicEntitySummariesByIds } from "../participation/presentation";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { unitOwnership, realmMember } from "../database/schema";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { PrincipalRequestContext } from "../auth/principal-context";
import type { DatabaseTransaction } from "../database";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import {
	realmEnrollment,
	realmEnforcement,
	realmEnrollmentOperation,
} from "@rezics/schema/postgres/realms/realm-enrollment";
import { resolveAccessSubject } from "../authorization/identities";
import { requireAccessAdmission, rethrowAccessFailure } from "../authorization/transaction";
import {
	AccessInputInvalid,
	AccessUnavailable,
	AccessRecordUnavailable,
	AccessDenied,
} from "../authorization/http-errors";
import { encryptOpaqueValue, decryptOpaqueValue } from "../authorization/opaque-values";
import { env } from "../config";
import { getCurrentRealmRules } from "./service";
import { presentEnrollment, enrollmentClock, realmEnrollmentRecipient } from "./membership";
import {
	realmEnrollmentScope,
	realmMembershipAuthority,
	enrollmentSubjectAuthority,
	membershipRecipients,
	membershipRecipientContext,
} from "./membership-policy";
import { RealmEnrollmentPageQuerySchema } from "./membership-contracts";
import { MembershipRecipientSchema } from "../participation/membership-contracts";
const cursorSettings = {
	secret: env.BETTER_AUTH_SECRET,
	keyContext: "realm-enrollment-page:v1",
	prefix: "rzre1.",
	maximumLength: 512,
};
function associated(context: PrincipalRequestContext, scopeId: string, view: string) {
	return Buffer.from(JSON.stringify([membershipRecipientContext(context, scopeId), view]));
}
async function recipient(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	scopeId: string,
	subjectId: string,
) {
	const subject = await resolveAccessSubject(tx, subjectId);
	if (!subject) throw new AccessUnavailable();
	return subject.kind === "entity"
		? { kind: "entity" as const, entityId: subject.id }
		: {
				kind: "principal" as const,
				selector: membershipRecipients.mint(
					subjectId,
					membershipRecipientContext(context, scopeId),
					(await enrollmentClock(tx)).getTime(),
				),
			};
}
/** Own status discloses only the selected subject; manager inspection requires native read authority. @alpha */
export async function readRealmEnrollment(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	target?: z.infer<typeof MembershipRecipientSchema>,
) {
	const scope = await realmEnrollmentScope(tx, realmId, false);
	const authority = target
		? await realmMembershipAuthority(tx, context, scope, false)
		: await enrollmentSubjectAuthority(tx, context, false);
	let disclosureAdmission = authority.admission;
	const subjectId = target
		? (await realmEnrollmentRecipient(tx, context, scope.scopeId, target)).subjectId
		: authority.subjectId;
	await tx.execute(
		sql`select public.lock_access_membership_key(${scope.scopeId}::uuid,${subjectId}::uuid,false)`,
	);
	const [head] = await tx
		.select()
		.from(realmEnrollment)
		.where(
			and(eq(realmEnrollment.scopeId, scope.scopeId), eq(realmEnrollment.subjectId, subjectId)),
		);
	const [member] = await tx
		.select()
		.from(accessMembership)
		.where(
			and(eq(accessMembership.scopeId, scope.scopeId), eq(accessMembership.subjectId, subjectId)),
		);
	const [enforcement] = await tx
		.select()
		.from(realmEnforcement)
		.where(
			and(eq(realmEnforcement.scopeId, scope.scopeId), eq(realmEnforcement.subjectId, subjectId)),
		);
	if (
		!target &&
		(scope.record.visibility === "private" ||
			scope.record.deletedAt !== null ||
			scope.record.status !== "published" ||
			scope.record.moderationStatus !== "approved") &&
		member?.activeGeneration == null &&
		!["invited", "pending"].includes(head?.state ?? "")
	) {
		try {
			const manager = await realmMembershipAuthority(tx, context, scope, false);
			disclosureAdmission = sql`(${disclosureAdmission}) and (${manager.admission})`;
		} catch (error) {
			try {
				rethrowAccessFailure(error);
			} catch (failure) {
				if (failure instanceof AccessDenied) throw new AccessRecordUnavailable();
				throw failure;
			}
		}
	}
	const selected = await recipient(tx, context, scope.scopeId, subjectId);
	const [ownership] =
		selected.kind === "entity"
			? await tx
					.select({ id: unitOwnership.id })
					.from(unitOwnership)
					.where(
						and(
							eq(unitOwnership.unitRealmId, realmId),
							eq(unitOwnership.profileId, selected.entityId),
							sql`${unitOwnership.revokedAt} is null`,
						),
					)
					.for("share")
			: [];
	const rules = await getCurrentRealmRules(realmId, tx);
	await requireAccessAdmission(tx, sql<boolean>`(${scope.admission}) and (${disclosureAdmission})`);
	return {
		controlRevision: scope.record.membershipControlRevision,
		joinPolicy: scope.record.joinPolicy,
		ruleRevisionId: rules?.revisionId ?? null,
		acknowledgedRuleRevisionId: head?.ruleRevisionId ?? null,
		recipient: selected,
		isOwner: ownership !== undefined,
		receipt: head && member ? presentEnrollment(head, member, enforcement) : null,
	};
}
/** Indexed physical scope/subject candidates precede recipient-kind filtering and hydration. @alpha */
export async function listRealmMembers(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	input: z.input<typeof RealmEnrollmentPageQuerySchema>,
) {
	const query = RealmEnrollmentPageQuerySchema.parse(input),
		scope = await realmEnrollmentScope(tx, realmId, false);
	const authority = await realmMembershipAuthority(tx, context, scope, false);
	const now = (await enrollmentClock(tx)).getTime(),
		aad = associated(context, scope.scopeId, query.view);
	let after: string | undefined;
	if (query.afterId) {
		try {
			const cursor = z
				.strictObject({ after: z.uuid(), expiresAt: z.number() })
				.parse(JSON.parse(decryptOpaqueValue(query.afterId, aad, cursorSettings).toString()));
			if (cursor.expiresAt <= now || cursor.expiresAt > now + 300000) throw new Error();
			after = cursor.after;
		} catch {
			throw new AccessInputInvalid();
		}
	}
	const rows = await tx
		.select()
		.from(realmEnrollment)
		.where(
			and(
				eq(realmEnrollment.scopeId, scope.scopeId),
				after ? gt(realmEnrollment.subjectId, after) : undefined,
			),
		)
		.orderBy(realmEnrollment.subjectId)
		.limit(51);
	const items = [];
	for (const candidate of rows.slice(0, 50)) {
		const key = candidate.subjectId;
		await tx.execute(
			sql`select public.lock_access_membership_key(${scope.scopeId}::uuid,${key}::uuid,false)`,
		);
		const [head] = await tx
			.select()
			.from(realmEnrollment)
			.where(and(eq(realmEnrollment.scopeId, scope.scopeId), eq(realmEnrollment.subjectId, key)));
		if (!head) throw new AccessUnavailable();
		const subject = await resolveAccessSubject(tx, head.subjectId);
		if (!subject) throw new AccessUnavailable();
		if ((query.view === "public") !== (subject.kind === "entity")) continue;
		const [member] = await tx
			.select()
			.from(accessMembership)
			.where(eq(accessMembership.id, head.membershipId));
		const [restriction] = await tx
			.select()
			.from(realmEnforcement)
			.where(
				and(
					eq(realmEnforcement.scopeId, scope.scopeId),
					eq(realmEnforcement.subjectId, head.subjectId),
				),
			);
		if (!member) throw new AccessUnavailable();
		items.push({
			recipient: await recipient(tx, context, scope.scopeId, head.subjectId),
			receipt: presentEnrollment(head, member, restriction),
		});
	}
	await requireAccessAdmission(tx, sql<boolean>`(${scope.admission}) and (${authority.admission})`);
	return {
		items,
		nextCursor:
			rows.length > 50
				? encryptOpaqueValue(
						Buffer.from(JSON.stringify({ after: rows[49]!.subjectId, expiresAt: now + 300000 })),
						aad,
						cursorSettings,
					)
				: null,
	};
}
/** Private history uses exact recipient selection and a physical operation key range. @alpha */
export async function listRealmMembershipHistory(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	target: z.infer<typeof MembershipRecipientSchema>,
	afterRevision?: number,
) {
	const scope = await realmEnrollmentScope(tx, realmId, false),
		authority = await realmMembershipAuthority(tx, context, scope, false);
	const { subjectId } = await realmEnrollmentRecipient(tx, context, scope.scopeId, target);
	const rows = await tx
		.select({
			operationId: realmEnrollmentOperation.operationId,
			operation: realmEnrollmentOperation.operation,
			result: realmEnrollmentOperation.result,
			createdAt: realmEnrollmentOperation.createdAt,
		})
		.from(realmEnrollmentOperation)
		.where(
			and(
				eq(realmEnrollmentOperation.scopeId, scope.scopeId),
				eq(realmEnrollmentOperation.subjectId, subjectId),
				afterRevision !== undefined
					? gt(realmEnrollmentOperation.revision, afterRevision)
					: undefined,
			),
		)
		.orderBy(realmEnrollmentOperation.revision)
		.limit(51);
	await requireAccessAdmission(tx, sql<boolean>`(${scope.admission}) and (${authority.admission})`);
	return {
		items: rows.slice(0, 50).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
		nextCursor: rows.length > 50 ? rows[49]!.result.revision : null,
	};
}

/** Retained public roster presentation hydrates only explicitly enrolled Entities. @alpha */
export async function listPublicRealmMembers(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
	query: { afterId?: string; localizationLanguages?: readonly string[] },
) {
	const page = await listRealmMembers(tx, context, realmId, {
		view: "public",
		afterId: query.afterId,
	});
	const entities = page.items.flatMap((item) =>
		item.recipient.kind === "entity"
			? [{ id: item.recipient.entityId, receipt: item.receipt }]
			: [],
	);
	const presentation = await getPublicEntitySummariesByIds(
		entities.map((item) => item.id),
		query.localizationLanguages ?? [],
		tx,
	);
	const addresses = await getPublicCanonicalUnitSlugAddresses([...presentation.keys()], tx);
	const [owner] = await tx
		.select({ profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitRealmId, realmId), sql`${unitOwnership.revokedAt} is null`))
		.for("share");
	const timestamps = entities.length
		? await tx
				.select({ profileId: realmMember.profileId, joinedAt: realmMember.joinedAt })
				.from(realmMember)
				.where(
					and(
						eq(realmMember.realmId, realmId),
						inArray(
							realmMember.profileId,
							entities.map((item) => item.id),
						),
					),
				)
		: [];
	const scope = await realmEnrollmentScope(tx, realmId, false),
		authority = await realmMembershipAuthority(tx, context, scope, false);
	await requireAccessAdmission(tx, authority.admission);
	return {
		items: entities.map(({ id, receipt }) => ({
			profileId: id,
			name: presentation.get(id)?.title ?? null,
			language: presentation.get(id)?.language ?? null,
			avatar: presentation.get(id)?.avatar ?? null,
			slugAddress: addresses.get(id) ?? null,
			isOwner: owner?.profileId === id,
			state:
				receipt.activeGeneration !== null
					? receipt.enforcement === "clear"
						? ("active" as const)
						: receipt.enforcement
					: receipt.state === "approved"
						? ("removed" as const)
						: receipt.state,
			joinedAt: timestamps.find((row) => row.profileId === id)!.joinedAt,
		})),
		nextCursor: page.nextCursor,
	};
}

/** Existing management affordances consume native permission outcomes; unknown policy is never an allow. @alpha */
export async function realmMembershipCapabilities(
	tx: DatabaseTransaction,
	context: PrincipalRequestContext,
	realmId: string,
) {
	const scope = await realmEnrollmentScope(tx, realmId, false);
	const probe = async (mutation: boolean) => {
		try {
			const authority = await realmMembershipAuthority(tx, context, scope, mutation, false);
			await requireAccessAdmission(tx, authority.admission);
			return true;
		} catch (error) {
			try {
				rethrowAccessFailure(error);
			} catch (failure) {
				if (failure instanceof AccessDenied) return false;
				throw failure;
			}
		}
	};
	return { canReadMembers: await probe(false), canManageMembers: await probe(true) };
}
