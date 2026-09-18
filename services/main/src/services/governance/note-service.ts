import type { PortableTextDocument as PortableTextDocumentValue } from "@rezics/block";
import type { ContentLanguage } from "@rezics/i18n";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { authEntity } from "@rezics/schema/postgres/access/participation";
import { selfAuthUserIdForEntity } from "../participation/account-query";

import type { DatabaseTransaction } from "../database";
import {
	governancePostBinding,
	unitAccessGrant,
	unitLocalization,
	unitOwnership,
	unitRevisionHead,
	type GovernanceNoteRoleValues,
	type GovernanceNoteSubjectKindValues,
} from "../database/schema";
import { presentPortableTextDocument } from "../documents/portable-text-presentation";
import { ensureSubjectPostTargetingAllowed } from "../posts/targeting";
import { createProfilePublisherAttribution } from "../units/attribution";
import { insertPlatformUnit } from "../units/create";
import { ParticipationDenied } from "../participation/policy";
import { recordUnitRevision } from "../units/history";
import { isFirstUnitLocalization } from "../units/localization";
import type { RevisionContributionInput } from "../units/revision-contribution";

export type GovernanceNoteRole = (typeof GovernanceNoteRoleValues)[number];
export type GovernanceNoteSubjectKind = (typeof GovernanceNoteSubjectKindValues)[number];

export type GovernanceNote = {
	role: GovernanceNoteRole;
	language: ContentLanguage;
	content: PortableTextDocumentValue;
};

export type GovernanceNoteRecord = GovernanceNote & {
	postId: string;
	latestRevisionId: string | null;
	subjectId: string;
	createdAt: Date;
	updatedAt: Date;
};

export async function createGovernanceNotePost(
	tx: DatabaseTransaction,
	input: {
		actorProfileId: string;
		subjectKind: GovernanceNoteSubjectKind;
		subjectId: string;
		subjectUnitId?: string;
		realmId?: string | null;
		viewerProfileIds?: readonly string[];
		publicRecipientProfileIds?: readonly string[];
		publicRecipientAuthUserIds?: readonly string[];
		revisionContribution?: RevisionContributionInput;
		note: GovernanceNote;
	},
): Promise<{ postId: string }> {
	const [actor] = await tx.select({ authUserId: authEntity.authUserId }).from(authEntity)
		.where(and(eq(authEntity.entityId, input.actorProfileId), eq(authEntity.state, "active")))
		.limit(1).for("share");
	if (!actor) throw new ParticipationDenied("Governance notes require the current operator account");
	const created = await insertPlatformUnit(tx, {
		owner: "post",
		values: {
			kind: "governance_note",
			subjectUnitId: input.subjectUnitId,
			status: "published",
			visibility: "private",
			postTargetingLocked: true,
			publishedAt: new Date(),
			createdByAuthUserId: actor.authUserId,
		},
		statusActor: { kind: "profile", profileId: input.actorProfileId },
	});
	await ensureSubjectPostTargetingAllowed(tx, {
		sourcePostId: created.id,
		subjectUnitId: input.subjectUnitId,
		...(input.realmId ? { realmIds: [input.realmId] } : {}),
	});
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: input.note.language,
		content: input.note.content,
		contentStatus: "published",
	});
	await tx.insert(unitOwnership).values({
		unitId: created.id,
		profileId: input.actorProfileId,
		assignedByProfileId: input.actorProfileId,
	});
	await createProfilePublisherAttribution(tx, {
		sourceUnitId: created.id,
		profileId: input.actorProfileId,
	});
	const viewerIds = new Set(input.viewerProfileIds ?? []);
	if (input.note.role === "public_notice")
		for (const profileId of input.publicRecipientProfileIds ?? []) viewerIds.add(profileId);
	viewerIds.delete(input.actorProfileId);
	const selfBindings = viewerIds.size
		? await tx
				.select({ authUserId: authEntity.authUserId })
				.from(authEntity)
				.where(inArray(authEntity.entityId, [...viewerIds]))
		: [];
	const accountIds = new Set(selfBindings.map((binding) => binding.authUserId));
	if (input.note.role === "public_notice")
		for (const id of input.publicRecipientAuthUserIds ?? []) accountIds.add(id);
	if (accountIds.size)
		await tx.insert(unitAccessGrant).values(
			[...accountIds].map((authUserId) => ({
				unitId: created.id,
				subjectKind: "auth" as const,
				authUserId,
				permission: "unit.read" as const,
				scope: [] as string[],
				grantedByAuthUserId: selfAuthUserIdForEntity(input.actorProfileId),
			})),
		);
	if (input.realmId)
		await tx.insert(unitAccessGrant).values({
			unitId: created.id,
			subjectKind: "realm",
			realmId: input.realmId,
			realmRelation: "member",
			permission: "unit.read",
			scope: [],
			grantedByAuthUserId: selfAuthUserIdForEntity(input.actorProfileId),
		});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.actorProfileId,
		contribution: input.revisionContribution,
		event: "create",
	});
	await tx.insert(governancePostBinding).values({
		postId: created.id,
		subjectKind: input.subjectKind,
		subjectId: input.subjectId,
		role: input.note.role,
	});
	return { postId: created.id };
}

async function readGovernanceNotes(
	tx: DatabaseTransaction,
	postIds: readonly string[],
): Promise<GovernanceNoteRecord[]> {
	if (!postIds.length) return [];
	const rows = await tx
		.select({
			postId: governancePostBinding.postId,
			latestRevisionId: unitRevisionHead.revisionId,
			subjectId: governancePostBinding.subjectId,
			role: governancePostBinding.role,
			language: unitLocalization.language,
			content: unitLocalization.content,
			createdAt: governancePostBinding.createdAt,
			updatedAt: unitLocalization.updatedAt,
		})
		.from(governancePostBinding)
		.innerJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, governancePostBinding.postId),
				isFirstUnitLocalization(unitLocalization.unitId),
			),
		)
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, governancePostBinding.postId))
		.where(inArray(governancePostBinding.postId, postIds));
	return rows.map((row) => ({
		postId: row.postId,
		latestRevisionId: row.latestRevisionId,
		subjectId: row.subjectId,
		role: row.role,
		language: row.language,
		content: presentPortableTextDocument(row.content, "post.body"),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}));
}

/** @internal Action notes have one immutable binding per role; case notes use pages. */
export async function listGovernanceNotes(
	tx: DatabaseTransaction,
	input: {
		subjectKind: Exclude<GovernanceNoteSubjectKind, "content_review_case">;
		subjectIds: readonly string[];
		roles?: readonly GovernanceNoteRole[];
	},
): Promise<GovernanceNoteRecord[]> {
	if (!input.subjectIds.length) return [];
	if (input.subjectIds.length > 100) throw new RangeError("At most 100 action subjects per page");
	const bindings = await tx.select({ postId: governancePostBinding.postId })
		.from(governancePostBinding).where(and(
			eq(governancePostBinding.subjectKind, input.subjectKind),
			inArray(governancePostBinding.subjectId, input.subjectIds),
			input.roles ? inArray(governancePostBinding.role, input.roles) : undefined,
		)).limit(input.subjectIds.length * 3);
	return readGovernanceNotes(tx, bindings.map(row => row.postId));
}

/** @internal Newest-first, immutable post UUID cursor; old notes remain individually addressable. */
export async function pageGovernanceCaseNotes(
	tx: DatabaseTransaction,
	input: { caseId: string; cursor?: string; limit?: number },
) {
	const limit = input.limit ?? 20;
	if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RangeError("Invalid note page size");
	const bindings = await tx.select({ postId: governancePostBinding.postId })
		.from(governancePostBinding).where(and(
			eq(governancePostBinding.subjectKind, "content_review_case"),
			eq(governancePostBinding.subjectId, input.caseId),
			input.cursor ? lt(governancePostBinding.postId, input.cursor) : undefined,
		)).orderBy(sql`${governancePostBinding.postId} desc`).limit(limit + 1);
	const page = bindings.slice(0, limit);
	const notes = await readGovernanceNotes(tx, page.map(row => row.postId));
	const byId = new Map(notes.map(note => [note.postId, note]));
	return {
		items: page.flatMap(row => { const note = byId.get(row.postId); return note ? [note] : []; }),
		nextCursor: bindings.length > limit ? page.at(-1)!.postId : null,
	};
}

/** @internal One latest note per case; indexed lateral seeks bound work for large histories. */
export async function previewGovernanceCaseNotes(tx: DatabaseTransaction, caseIds: readonly string[]) {
	if (caseIds.length > 100) throw new RangeError("At most 100 case previews per page");
	const result = new Map<string, { items: GovernanceNoteRecord[]; nextCursor: string | null }>();
	if (!caseIds.length) return result;
	const rows = await tx.execute<{ case_id: string; post_id: string }>(sql`
		select subjects.case_id, binding.post_id
		from unnest(array[${sql.join(caseIds.map(id => sql`${id}::uuid`), sql`, `)}]) subjects(case_id)
		cross join lateral (
			select post_id from public.governance_post_binding
			where subject_kind = 'content_review_case' and subject_id = subjects.case_id
			order by post_id desc limit 2
		) binding order by subjects.case_id, binding.post_id desc`);
	const first = new Map<string, string>();
	const more = new Set<string>();
	for (const row of rows.rows) {
		if (first.has(row.case_id)) more.add(row.case_id);
		else first.set(row.case_id, row.post_id);
	}
	const notes = await readGovernanceNotes(tx, [...first.values()]);
	const byId = new Map(notes.map(note => [note.postId, note]));
	for (const caseId of caseIds) {
		const postId = first.get(caseId), note = postId ? byId.get(postId) : undefined;
		result.set(caseId, { items: note ? [note] : [], nextCursor: more.has(caseId) && postId ? postId : null });
	}
	return result;
}

export async function getGovernanceNote(
	tx: DatabaseTransaction,
	postId: string,
): Promise<GovernanceNoteRecord | undefined> {
	return (await readGovernanceNotes(tx, [postId]))[0];
}
