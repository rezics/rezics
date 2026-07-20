import {
	PortableTextDocument,
	parseDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import { and, eq, inArray } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import type { DatabaseTransaction } from "../database";
import {
	governancePostBinding,
	post,
	unitAccessBinding,
	unitLocalization,
	unitRevisionHead,
	type GovernanceNoteRoleValues,
	type GovernanceNoteSubjectKindValues,
} from "../database/schema";
import { recordUnitRevision } from "../units/history";
import { insertUnit } from "../units/create";
import { isPrimaryUnitLocalization } from "../units/localization";

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
		note: GovernanceNote;
	},
): Promise<{ postId: string }> {
	const created = await insertUnit(tx, {
		kind: "post",
		status: "published",
		visibility: "private",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.actorProfileId },
	});
	await tx.insert(post).values({
		id: created.id,
		subjectUnitId: input.subjectUnitId,
		kind: "governance_note",
		locked: true,
	});
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: input.note.language,
		content: input.note.content,
		contentStatus: "published",
	});
	await tx.insert(unitAccessBinding).values({
		unitId: created.id,
		subjectKind: "profile",
		profileId: input.actorProfileId,
		role: "owner",
		scope: [],
		grantedByProfileId: input.actorProfileId,
	});
	const viewerIds = new Set(input.viewerProfileIds ?? []);
	if (input.note.role === "public_notice")
		for (const profileId of input.publicRecipientProfileIds ?? []) viewerIds.add(profileId);
	viewerIds.delete(input.actorProfileId);
	if (viewerIds.size)
		await tx.insert(unitAccessBinding).values(
			[...viewerIds].map((profileId) => ({
				unitId: created.id,
				subjectKind: "profile" as const,
				profileId,
				role: "viewer" as const,
				scope: [] as string[],
				grantedByProfileId: input.actorProfileId,
			})),
		);
	if (input.realmId)
		await tx.insert(unitAccessBinding).values({
			unitId: created.id,
			subjectKind: "realm",
			realmId: input.realmId,
			realmRelation: "governor",
			role: "viewer",
			scope: [],
			grantedByProfileId: input.actorProfileId,
		});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.actorProfileId,
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

export async function listGovernanceNotes(
	tx: DatabaseTransaction,
	input: {
		subjectKind: GovernanceNoteSubjectKind;
		subjectIds: readonly string[];
		roles?: readonly GovernanceNoteRole[];
	},
): Promise<GovernanceNoteRecord[]> {
	if (!input.subjectIds.length) return [];
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
				isPrimaryUnitLocalization(unitLocalization.unitId),
			),
		)
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, governancePostBinding.postId))
		.where(
			and(
				eq(governancePostBinding.subjectKind, input.subjectKind),
				inArray(governancePostBinding.subjectId, input.subjectIds),
				input.roles ? inArray(governancePostBinding.role, input.roles) : undefined,
			),
		);
	return rows.map((row) => ({
		postId: row.postId,
		latestRevisionId: row.latestRevisionId,
		subjectId: row.subjectId,
		role: row.role,
		language: row.language,
		content: parseDocument(PortableTextDocument, row.content),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}));
}

export async function getGovernanceNote(
	tx: DatabaseTransaction,
	postId: string,
): Promise<GovernanceNoteRecord | undefined> {
	const [binding] = await tx
		.select({
			subjectKind: governancePostBinding.subjectKind,
			subjectId: governancePostBinding.subjectId,
			role: governancePostBinding.role,
		})
		.from(governancePostBinding)
		.where(eq(governancePostBinding.postId, postId))
		.limit(1);
	if (!binding) return undefined;
	const notes = await listGovernanceNotes(tx, {
		subjectKind: binding.subjectKind,
		subjectIds: [binding.subjectId],
		roles: [binding.role],
	});
	return notes.find((note) => note.postId === postId);
}
