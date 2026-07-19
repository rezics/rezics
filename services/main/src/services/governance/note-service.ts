import {
	PortableTextDocument,
	parseDocument,
	type PortableTextDocument as PortableTextDocumentValue,
} from "@rezics/block";
import { and, eq, inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	governancePostBinding,
	post,
	revisionContent,
	unitAccessBinding,
	unitLocalization,
	unitRevisionSlot,
	type GovernanceNoteRoleValues,
	type GovernanceNoteSubjectKindValues,
} from "../database/schema";
import { recordUnitRevision } from "../units/history";
import { insertAddressedUnit } from "../units/slug-address";
import { generateSlugLabel } from "../units/slug";

export type GovernanceNoteRole = (typeof GovernanceNoteRoleValues)[number];
export type GovernanceNoteSubjectKind = (typeof GovernanceNoteSubjectKindValues)[number];

export type GovernanceNote = {
	role: GovernanceNoteRole;
	language: string;
	content: PortableTextDocumentValue;
};

export type GovernanceNoteRecord = GovernanceNote & {
	postId: string;
	revisionId: string;
	subjectId: string;
	createdAt: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function presentLocalization(payload: unknown): Pick<GovernanceNote, "language" | "content"> {
	if (!isRecord(payload) || payload.version !== 1 || !Array.isArray(payload.items))
		throw new Error("Governance note revision has an invalid localization snapshot");
	const [localization] = payload.items;
	if (!isRecord(localization) || typeof localization.language !== "string")
		throw new Error("Governance note revision is missing its localization");
	return {
		language: localization.language,
		content: parseDocument(PortableTextDocument, localization.content),
	};
}

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
): Promise<{ postId: string; revisionId: string }> {
	const created = await insertAddressedUnit(tx, {
		kind: "post",
		slugScopeId: input.actorProfileId,
		slug: generateSlugLabel(
			`governance-note-${input.subjectKind}-${input.subjectId}-${input.note.role}-${crypto.randomUUID()}`,
			"governance-note",
		),
		status: "published",
		visibility: "private",
		publishedAt: new Date(),
	});
	await tx.insert(post).values({
		id: created.id,
		authorProfileId: input.actorProfileId,
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
	const revision = await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.actorProfileId,
		event: "create",
	});
	await tx.insert(governancePostBinding).values({
		postId: created.id,
		revisionId: revision.revisionId,
		subjectKind: input.subjectKind,
		subjectId: input.subjectId,
		role: input.note.role,
	});
	return { postId: created.id, revisionId: revision.revisionId };
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
			revisionId: governancePostBinding.revisionId,
			subjectId: governancePostBinding.subjectId,
			role: governancePostBinding.role,
			payload: revisionContent.payload,
			createdAt: governancePostBinding.createdAt,
		})
		.from(governancePostBinding)
		.innerJoin(
			unitRevisionSlot,
			and(
				eq(unitRevisionSlot.revisionId, governancePostBinding.revisionId),
				eq(unitRevisionSlot.unitId, governancePostBinding.postId),
				eq(unitRevisionSlot.role, "localizations"),
			),
		)
		.innerJoin(revisionContent, eq(revisionContent.id, unitRevisionSlot.contentId))
		.where(
			and(
				eq(governancePostBinding.subjectKind, input.subjectKind),
				inArray(governancePostBinding.subjectId, input.subjectIds),
				input.roles ? inArray(governancePostBinding.role, input.roles) : undefined,
			),
		);
	return rows.map((row) => ({
		postId: row.postId,
		revisionId: row.revisionId,
		subjectId: row.subjectId,
		role: row.role,
		...presentLocalization(row.payload),
		createdAt: row.createdAt,
	}));
}
