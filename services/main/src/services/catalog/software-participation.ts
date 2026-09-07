import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	softwareParticipation as heads,
	softwareParticipationRevision as revisions,
} from "../database/schema/catalog-software-participation";
import { softwareParticipationContextRevision } from "../database/schema/catalog-software";
import {
	catalogDefinitionRevision,
	catalogDefinition,
	entityIdentity,
} from "../database/schema/catalog-identity";
import type { CatalogReference } from "./contracts";
import { requireCatalogNameRevision } from "./names";
import { CatalogReferenceNotFound, CatalogRevisionConflict, loadCatalogIdentity } from "./storage";
const revisionNumber = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

/** @alpha @remarks A native role connects an actor, its exact credited alias and optional context/character. */
export const SoftwareParticipationValuesSchema = z.strictObject({
	entityId: z.uuid(),
	name: z.strictObject({ id: z.uuid(), revision: revisionNumber }).nullable(),
	context: z.strictObject({ id: z.uuid(), revision: revisionNumber }).nullable(),
	characterId: z.uuid().nullable(),
	roleRevisionId: z.uuid(),
	note: z
		.string()
		.refine((value) => Buffer.byteLength(value) <= 16384)
		.nullable(),
	state: z.enum(["active", "withdrawn"]),
});
export type SoftwareParticipationValues = z.input<typeof SoftwareParticipationValuesSchema>;
async function requireContent(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string | null,
	write: boolean,
) {
	const identity = await loadCatalogIdentity(tx, content, actor, write, "share");
	if (content.owner !== "software" || identity.shape !== "content")
		throw new TypeError("Participation requires software content");
}
async function checkedValues(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	input: SoftwareParticipationValues,
) {
	const value = SoftwareParticipationValuesSchema.parse(input);
	const entity = await loadCatalogIdentity(
		tx,
		{ owner: "entity", id: value.entityId },
		actor,
		false,
	);
	if (!["person", "organization", "collective", "unresolved", "label"].includes(entity.shape))
		throw new TypeError("Participation requires a credited person or organization");
	if (value.name)
		await requireCatalogNameRevision(
			tx,
			{ owner: "entity", id: value.entityId },
			actor,
			value.name.id,
			value.name.revision,
		);
	if (value.characterId) {
		const character = await loadCatalogIdentity(
			tx,
			{ owner: "entity", id: value.characterId },
			actor,
			false,
		);
		if (character.shape !== "character")
			throw new TypeError("Voice participation requires a Character");
	}
	if (value.context) {
		const t = softwareParticipationContextRevision;
		const [context] = await tx
			.select({ state: t.state })
			.from(t)
			.where(
				and(
					eq(t.contentId, content.id),
					eq(t.contextId, value.context.id),
					eq(t.revision, value.context.revision),
				),
			)
			.limit(1);
		if (!context) throw new CatalogReferenceNotFound("Participation context revision is missing");
	}
	const [role] = await tx
		.select({ kind: catalogDefinition.kind })
		.from(catalogDefinitionRevision)
		.innerJoin(catalogDefinition, eq(catalogDefinition.id, catalogDefinitionRevision.definitionId))
		.where(eq(catalogDefinitionRevision.id, value.roleRevisionId))
		.limit(1);
	if (role?.kind !== "vocabulary")
		throw new TypeError("Participation role requires a vocabulary revision");
	return {
		entityId: value.entityId,
		nameId: value.name?.id ?? null,
		nameRevision: value.name?.revision ?? null,
		contextId: value.context?.id ?? null,
		contextRevision: value.context?.revision ?? null,
		characterId: value.characterId,
		roleRevisionId: value.roleRevisionId,
		note: value.note,
		state: value.state,
	};
}

/** @alpha @remarks Manual/source writers use the same exact-revision, source-independent command. */
export async function createSoftwareParticipation(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	input: SoftwareParticipationValues,
) {
	await requireContent(tx, content, actor, true);
	const value = await checkedValues(tx, content, actor, input);
	const [identity] = await tx.insert(heads).values({ contentId: content.id }).returning();
	if (!identity) throw new Error("Participation insertion returned no identity");
	await tx.insert(revisions).values({
		contentId: content.id,
		participationId: identity.id,
		revision: 1,
		...value,
		createdByAuthUserId: actor,
	});
	await tx
		.update(heads)
		.set({ currentRevision: 1 })
		.where(and(eq(heads.contentId, content.id), eq(heads.id, identity.id)));
	return { participationId: identity.id, revision: 1 };
}

/** @alpha @remarks Child CAS prevents local alias/context edits being overwritten by a source update. */
export async function reviseSoftwareParticipation(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	participationId: string,
	expectedRevision: number,
	input: SoftwareParticipationValues,
) {
	z.uuid().parse(participationId);
	revisionNumber.max(Number.MAX_SAFE_INTEGER - 1).parse(expectedRevision);
	await requireContent(tx, content, actor, true);
	const value = await checkedValues(tx, content, actor, input);
	const [identity] = await tx
		.select()
		.from(heads)
		.where(and(eq(heads.contentId, content.id), eq(heads.id, participationId)))
		.limit(1)
		.for("update");
	if (!identity) throw new CatalogReferenceNotFound("Participation is missing");
	if (identity.currentRevision !== expectedRevision)
		throw new CatalogRevisionConflict("Participation revision changed");
	const revision = expectedRevision + 1;
	await tx.insert(revisions).values({
		contentId: content.id,
		participationId,
		revision,
		...value,
		createdByAuthUserId: actor,
	});
	await tx
		.update(heads)
		.set({ currentRevision: revision })
		.where(and(eq(heads.contentId, content.id), eq(heads.id, participationId)));
	return { participationId, revision };
}

/** @alpha @remarks Bounded native read/export pages use content-local keysets. */
export async function readSoftwareParticipations(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string | null,
	input: { afterId?: string; limit?: number; includeWithdrawn?: boolean } = {},
) {
	const page = z
		.strictObject({
			afterId: z.uuid().optional(),
			limit: z.number().int().min(1).max(100).default(50),
			includeWithdrawn: z.boolean().default(false),
		})
		.parse(input);
	await requireContent(tx, content, actor, page.includeWithdrawn);
	const visibleEntity = (column: typeof revisions.entityId | typeof revisions.characterId) =>
		sql`exists (select 1 from ${entityIdentity} where ${entityIdentity.id} = ${column} and ${entityIdentity.deletedAt} is null and ((${entityIdentity.createdByAuthUserId} = ${actor}::uuid) is true or (${entityIdentity.visibility} in ('public','unlisted') and ${entityIdentity.status} = 'published' and ${entityIdentity.moderationStatus} = 'approved')))`;
	const rows = await tx
		.select({ value: revisions })
		.from(heads)
		.innerJoin(
			revisions,
			and(
				eq(heads.contentId, revisions.contentId),
				eq(heads.id, revisions.participationId),
				eq(heads.currentRevision, revisions.revision),
			),
		)
		.where(
			and(
				eq(heads.contentId, content.id),
				page.includeWithdrawn ? undefined : eq(revisions.state, "active"),
				page.afterId ? gt(heads.id, page.afterId) : undefined,
				visibleEntity(revisions.entityId),
				sql`(${revisions.characterId} is null or ${visibleEntity(revisions.characterId)})`,
			),
		)
		.orderBy(heads.id)
		.limit(page.limit);
	return rows.map((row) => row.value);
}

/** @alpha @remarks Historical restore appends complete values and never rewrites source evidence. */
export async function restoreSoftwareParticipation(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	participationId: string,
	expectedRevision: number,
	historicalRevision: number,
) {
	await requireContent(tx, content, actor, true);
	revisionNumber.parse(historicalRevision);
	const [row] = await tx
		.select()
		.from(revisions)
		.where(
			and(
				eq(revisions.contentId, content.id),
				eq(revisions.participationId, z.uuid().parse(participationId)),
				eq(revisions.revision, historicalRevision),
			),
		)
		.limit(1);
	if (!row) throw new CatalogReferenceNotFound("Participation revision is missing");
	return reviseSoftwareParticipation(tx, content, actor, participationId, expectedRevision, {
		entityId: row.entityId,
		name: row.nameId && row.nameRevision ? { id: row.nameId, revision: row.nameRevision } : null,
		context:
			row.contextId && row.contextRevision
				? { id: row.contextId, revision: row.contextRevision }
				: null,
		characterId: row.characterId,
		roleRevisionId: row.roleRevisionId,
		note: row.note,
		state: row.state,
	});
}

/** @alpha @remarks Owner-only immutable history pages preserve aliases and contexts as originally credited. */
export async function readSoftwareParticipationHistory(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	participationId: string,
	input: { afterRevision?: number; limit?: number } = {},
) {
	z.uuid().parse(participationId);
	const page = z
		.strictObject({
			afterRevision: revisionNumber.optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	await requireContent(tx, content, actor, true);
	return tx
		.select()
		.from(revisions)
		.where(
			and(
				eq(revisions.contentId, content.id),
				eq(revisions.participationId, participationId),
				page.afterRevision ? gt(revisions.revision, page.afterRevision) : undefined,
			),
		)
		.orderBy(revisions.revision)
		.limit(page.limit);
}
