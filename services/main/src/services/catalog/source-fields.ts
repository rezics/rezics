import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import {
	appendCatalogFactNodes,
	beginCatalogFact,
	ensureCatalogDefinition,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";

/** A typed source observation envelope allows the upstream field's declared representation variants. */
export async function appendSourceFieldObservation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		readonly namespace: string;
		readonly field: string;
		readonly value: unknown;
		readonly sourceRecordId: string;
		readonly snapshotId: string;
	},
) {
	const key =
		input.field.length <= 160
			? input.field
			: `field.${createHash("sha256").update(input.field).digest("hex")}`;
	const definition = await ensureCatalogDefinition(tx, {
		namespace: input.namespace,
		key,
		kind: "property",
		valueKind: "object",
	});
	const fact = await beginCatalogFact(
		tx,
		reference,
		actor,
		expectedRevision,
		definition.revisionId,
	);
	let revision = fact.revision;
	let position = -1;
	let batch = [];
	for (const node of catalogValueNodes({ value: input.value })) {
		batch.push(node);
		if (batch.length === 512) {
			const appended = await appendCatalogFactNodes(
				tx,
				reference,
				actor,
				revision,
				fact.id,
				position,
				batch,
			);
			revision = appended.revision;
			position = appended.lastNodePosition;
			batch = [];
		}
	}
	if (batch.length) {
		const appended = await appendCatalogFactNodes(
			tx,
			reference,
			actor,
			revision,
			fact.id,
			position,
			batch,
		);
		revision = appended.revision;
		position = appended.lastNodePosition;
	}
	revision = (await sealCatalogFact(tx, reference, actor, revision, fact.id, position)).revision;
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		ownerId: reference.id,
		factId: fact.id,
		sourceRecordId: input.sourceRecordId,
		snapshotId: input.snapshotId,
		sourcePath: `/${input.field.replaceAll("~", "~0").replaceAll("/", "~1")}`,
	});
	return revision;
}
