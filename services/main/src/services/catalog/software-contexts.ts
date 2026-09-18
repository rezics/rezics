import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import {
	softwareParticipationContext,
	softwareParticipationContextRevision,
} from "@rezics/schema/postgres/software/software";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { CatalogReferenceNotFound, CatalogRevisionConflict, loadCatalogIdentity } from "./storage";

const revisionNumber = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const boundedText = (maximum: number) =>
	z
		.string()
		.min(1)
		.refine((value) => Buffer.byteLength(value, "utf8") <= maximum);

/**
 * Complete provider-free values for a software participation context.
 * @alpha
 * @remarks Catalog command contract; participation does not assert a software version or authority.
 */
export const SoftwareParticipationContextValuesSchema = z.strictObject({
	label: boundedText(4096).nullable(),
	languageTag: boundedText(255).transform(canonicalizeContentLanguageTag).nullable(),
	state: z.enum(["active", "withdrawn"]),
});
export type SoftwareParticipationContextValues = z.input<
	typeof SoftwareParticipationContextValuesSchema
>;

async function requireContent(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string | null,
	write: boolean,
) {
	if (content.owner !== "software") throw new TypeError("Expected software content owner");
	const identity = await loadCatalogIdentity(tx, content, actor, write, "share");
	if (identity.shape !== "content") throw new TypeError("Expected software content identity");
}

/**
 * Create a source-free participation context and its first immutable revision.
 * @alpha
 * @remarks Restricted by the content owner's existing catalog write policy.
 */
export async function createSoftwareParticipationContext(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	input: SoftwareParticipationContextValues,
) {
	const values = SoftwareParticipationContextValuesSchema.parse(input);
	await requireContent(tx, content, actor, true);
	const [context] = await tx
		.insert(softwareParticipationContext)
		.values({ contentId: content.id })
		.returning();
	if (!context) throw new Error("Participation context insertion returned no row");
	await tx
		.insert(softwareParticipationContextRevision)
		.values({
			contentId: content.id,
			contextId: context.id,
			revision: 1,
			...values,
			createdByAuthUserId: actor,
		});
	await tx
		.update(softwareParticipationContext)
		.set({ currentRevision: 1 })
		.where(
			and(
				eq(softwareParticipationContext.contentId, content.id),
				eq(softwareParticipationContext.id, context.id),
			),
		);
	return { contentId: content.id, contextId: context.id, revision: 1, ...values };
}

/**
 * Read complete current values using the context's owner-local key.
 * @alpha
 * @remarks The content owner's catalog read policy also protects context history.
 */
export async function readSoftwareParticipationContext(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string | null,
	contextId: string,
) {
	z.uuid().parse(contextId);
	await requireContent(tx, content, actor, false);
	const header = softwareParticipationContext;
	const revision = softwareParticipationContextRevision;
	const [row] = await tx
		.select({
			contentId: revision.contentId,
			contextId: revision.contextId,
			revision: revision.revision,
			label: revision.label,
			languageTag: revision.languageTag,
			state: revision.state,
			createdAt: revision.createdAt,
			createdByAuthUserId: revision.createdByAuthUserId,
		})
		.from(header)
		.innerJoin(
			revision,
			and(
				eq(header.contentId, revision.contentId),
				eq(header.id, revision.contextId),
				eq(header.currentRevision, revision.revision),
			),
		)
		.where(and(eq(header.contentId, content.id), eq(header.id, contextId)))
		.limit(1);
	if (!row)
		throw new CatalogReferenceNotFound(
			"Participation context is missing or has no published revision",
		);
	return row;
}

/**
 * Append a complete revision with optimistic concurrency on this context.
 * @alpha
 * @remarks Neither labels nor source identifiers are context identity keys.
 */
export async function reviseSoftwareParticipationContext(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	contextId: string,
	expectedRevision: number,
	input: SoftwareParticipationContextValues,
) {
	z.uuid().parse(contextId);
	revisionNumber.max(Number.MAX_SAFE_INTEGER - 1).parse(expectedRevision);
	const values = SoftwareParticipationContextValuesSchema.parse(input);
	await requireContent(tx, content, actor, true);
	const header = softwareParticipationContext;
	const [context] = await tx
		.select()
		.from(header)
		.where(and(eq(header.contentId, content.id), eq(header.id, contextId)))
		.for("update")
		.limit(1);
	if (!context) throw new CatalogReferenceNotFound("Participation context is missing");
	if (context.currentRevision !== expectedRevision)
		throw new CatalogRevisionConflict("Participation context revision changed");
	const revision = expectedRevision + 1;
	await tx
		.insert(softwareParticipationContextRevision)
		.values({ contentId: content.id, contextId, revision, ...values, createdByAuthUserId: actor });
	await tx
		.update(header)
		.set({ currentRevision: revision })
		.where(
			and(
				eq(header.contentId, content.id),
				eq(header.id, contextId),
				eq(header.currentRevision, expectedRevision),
			),
		);
	return { contentId: content.id, contextId, revision, ...values };
}

/**
 * Page immutable revisions with a bounded keyset scan.
 * @alpha
 * @remarks At most 100 revisions are returned; the last revision is the next cursor.
 */
export async function readSoftwareParticipationContextHistory(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string | null,
	contextId: string,
	input: { afterRevision?: number; limit?: number } = {},
) {
	z.uuid().parse(contextId);
	const page = z
		.strictObject({
			afterRevision: revisionNumber.optional(),
			limit: z.number().int().min(1).max(100).default(50),
		})
		.parse(input);
	await readSoftwareParticipationContext(tx, content, actor, contextId);
	const revision = softwareParticipationContextRevision;
	return tx
		.select()
		.from(revision)
		.where(
			and(
				eq(revision.contentId, content.id),
				eq(revision.contextId, contextId),
				page.afterRevision === undefined ? undefined : gt(revision.revision, page.afterRevision),
			),
		)
		.orderBy(revision.revision)
		.limit(page.limit);
}

/**
 * Restore historical values by appending a new revision.
 * @alpha
 * @remarks The expected revision prevents restoring over a concurrent change.
 */
export async function restoreSoftwareParticipationContext(
	tx: DatabaseTransaction,
	content: CatalogReference,
	actor: string,
	contextId: string,
	expectedRevision: number,
	restoreRevision: number,
) {
	z.uuid().parse(contextId);
	revisionNumber.parse(restoreRevision);
	await requireContent(tx, content, actor, true);
	const revision = softwareParticipationContextRevision;
	const [previous] = await tx
		.select()
		.from(revision)
		.where(
			and(
				eq(revision.contentId, content.id),
				eq(revision.contextId, contextId),
				eq(revision.revision, restoreRevision),
			),
		)
		.limit(1);
	if (!previous) throw new CatalogReferenceNotFound("Participation context revision is missing");
	return reviseSoftwareParticipationContext(tx, content, actor, contextId, expectedRevision, {
		label: previous.label,
		languageTag: previous.languageTag,
		state: previous.state,
	});
}
