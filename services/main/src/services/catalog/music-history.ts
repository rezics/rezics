import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { musicComponentRevision } from "../database/schema/catalog-music";
import { CatalogPageSchema, type CatalogReference } from "./contracts";
import { loadCatalogIdentity } from "./storage";
import { editMusicReleaseMetadata } from "./music-domain";

/** @alpha Native history is editor-only because past revisions can retain private references. */
export async function listMusicComponentRevisions(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	component: string,
	componentKey: string,
	input: z.input<typeof CatalogPageSchema> = {},
) {
	if (reference.owner !== "music") throw new TypeError("Expected music owner");
	await loadCatalogIdentity(tx, reference, actor, true);
	z.string().min(1).max(96).parse(component);
	z.string().min(1).max(1536).parse(componentKey);
	const page = CatalogPageSchema.parse(input);
	const table = musicComponentRevision;
	let afterSequence: number | undefined;
	if (page.afterId) {
		const [cursor] = await tx
			.select({ sequence: table.componentSequence })
			.from(table)
			.where(
				and(
					eq(table.ownerId, reference.id),
					eq(table.id, page.afterId),
					eq(table.component, component),
					eq(table.componentKey, componentKey),
				),
			)
			.limit(1);
		if (!cursor) throw new TypeError("Music history cursor belongs to another component");
		afterSequence = cursor.sequence;
	}
	return tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.component, component),
				eq(table.componentKey, componentKey),
				afterSequence !== undefined ? gt(table.componentSequence, afterSequence) : undefined,
			),
		)
		.orderBy(table.componentSequence)
		.limit(page.limit);
}

/** @alpha Restoring release metadata creates a new native revision and preserves intervening history. */
export async function restoreMusicReleaseMetadata(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	historyId: string,
) {
	if (reference.owner !== "music") throw new TypeError("Expected music owner");
	await loadCatalogIdentity(tx, reference, actor, true);
	z.uuid().parse(historyId);
	const table = musicComponentRevision;
	const [row] = await tx
		.select()
		.from(table)
		.where(
			and(
				eq(table.ownerId, reference.id),
				eq(table.id, historyId),
				eq(table.component, "music_release"),
				eq(table.componentKey, reference.id),
			),
		)
		.limit(1);
	if (!row || row.operation === "DELETE")
		throw new TypeError("No restorable release metadata revision");
	const value = z
		.object({
			status_revision_id: z.uuid().nullable(),
			packaging_revision_id: z.uuid().nullable(),
			language_tag: z.string().nullable(),
			script_code: z.string().nullable(),
			barcode: z.string().nullable(),
		})
		.parse(row.value);
	return editMusicReleaseMetadata(tx, reference, actor, expectedRevision, {
		statusRevisionId: value.status_revision_id,
		packagingRevisionId: value.packaging_revision_id,
		languageTag: value.language_tag,
		scriptCode: value.script_code,
		barcode: value.barcode,
	});
}
