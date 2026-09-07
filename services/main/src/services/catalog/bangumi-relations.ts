import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { type CatalogReference } from "./contracts";
import { BangumiArchiveRelationSchema, bangumiRelationKey } from "./bangumi-records";
import { BangumiArchiveContractSha256, resolveBangumiDependency } from "./bangumi-adoption";
import {
	createCatalogRelation,
	appendCatalogFactNodes,
	beginCatalogFact,
	loadCatalogIdentity,
	sealCatalogFact,
} from "./storage";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { catalogValueNodes } from "./value-nodes";

/** A reviewed mapping references native semantic definitions rather than creating a provider ontology. @internal */
export const BangumiRelationMappingSchema = z.strictObject({
	predicateRevisionId: z.uuid(),
	roles: z.partialRecord(
		z.enum(["subject", "related_subject", "person", "related_person", "character"]),
		z.uuid(),
	),
	qualifiers: z.partialRecord(
		z.enum(["relation_type", "order", "type", "position", "appear_eps", "summary", "ended"]),
		z.uuid(),
	),
});

/** Every archive relation's context and qualifiers are explicit before any native write. @internal */
export function planBangumiArchiveRelation(input: z.input<typeof BangumiArchiveRelationSchema>) {
	const row = BangumiArchiveRelationSchema.parse(input);
	const participants: {
		role: keyof z.output<typeof BangumiRelationMappingSchema>["roles"];
		objectType: "subject" | "person" | "character";
		id: number;
	}[] = [];
	const qualifiers: {
		key: keyof z.output<typeof BangumiRelationMappingSchema>["qualifiers"];
		value: string | number | boolean;
	}[] = [];
	switch (row.kind) {
		case "subject-relations":
			participants.push(
				{ role: "subject", objectType: "subject", id: row.subject_id },
				{ role: "related_subject", objectType: "subject", id: row.related_subject_id },
			);
			qualifiers.push(
				{ key: "relation_type", value: row.relation_type },
				{ key: "order", value: row.order },
			);
			break;
		case "subject-characters":
			participants.push(
				{ role: "subject", objectType: "subject", id: row.subject_id },
				{ role: "character", objectType: "character", id: row.character_id },
			);
			qualifiers.push({ key: "type", value: row.type }, { key: "order", value: row.order });
			break;
		case "subject-persons":
			participants.push(
				{ role: "subject", objectType: "subject", id: row.subject_id },
				{ role: "person", objectType: "person", id: row.person_id },
			);
			qualifiers.push({ key: "position", value: row.position });
			if (row.appear_eps !== undefined)
				qualifiers.push({ key: "appear_eps", value: row.appear_eps });
			break;
		case "person-characters":
			participants.push(
				{ role: "subject", objectType: "subject", id: row.subject_id },
				{ role: "person", objectType: "person", id: row.person_id },
				{ role: "character", objectType: "character", id: row.character_id },
			);
			qualifiers.push({ key: "summary", value: row.summary });
			break;
		case "person-relations": {
			const objectType = row.person_type === "prsn" ? "person" : "character";
			participants.push(
				{ role: "person", objectType, id: row.person_id },
				{ role: "related_person", objectType, id: row.related_person_id },
			);
			qualifiers.push(
				{ key: "relation_type", value: row.relation_type },
				{ key: "ended", value: row.ended === true || row.ended === 1 },
			);
			break;
		}
	}
	return {
		row,
		participants,
		qualifiers,
		spoiler:
			row.kind === "person-relations" && (row.spoiler === true || row.spoiler === 1)
				? (1 as const)
				: (0 as const),
	};
}

/**
 * Adopts one archive relationship using exact resolved native targets and registered role/qualifier definitions.
 * @internal
 * The owner's expected revision prevents replay from creating duplicate native relations.
 */
export async function adoptBangumiArchiveRelation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
	mappingInput: z.input<typeof BangumiRelationMappingSchema>,
) {
	if (
		bytes.byteLength > 512_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.contractSha256 !== BangumiArchiveContractSha256 ||
		receipt.key.source !== "bangumi"
	)
		throw new TypeError("Archive relationship differs from its reviewed receipt or byte budget");
	const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	const record = z.record(z.string(), z.unknown()).parse(raw);
	const plan = planBangumiArchiveRelation(
		BangumiArchiveRelationSchema.parse({ ...record, kind: receipt.key.objectType }),
	);
	if (receipt.key.externalId !== bangumiRelationKey(plan.row))
		throw new TypeError("Archive relationship tuple differs from its source key");
	const mapping = BangumiRelationMappingSchema.parse(mappingInput);
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const participants = [];
	for (const participant of plan.participants) {
		const roleRevisionId = mapping.roles[participant.role];
		if (!roleRevisionId) throw new TypeError(`Missing reviewed role: ${participant.role}`);
		participants.push({
			roleRevisionId,
			target: await resolveBangumiDependency(tx, actor, participant.objectType, participant.id),
		});
	}
	const primary = participants[0]?.target;
	if (!primary || primary.owner !== reference.owner || primary.id !== reference.id)
		throw new TypeError("Relation owner differs from its source subject");
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	if (identity.revision !== expectedRevision) throw new Error("Catalog revision changed");
	let revision = expectedRevision;
	const qualifiers: { definitionRevisionId: string; valueFactId: string }[] = [];
	for (const qualifier of plan.qualifiers) {
		const definitionRevisionId = mapping.qualifiers[qualifier.key];
		if (!definitionRevisionId) throw new TypeError(`Missing reviewed qualifier: ${qualifier.key}`);
		const fact = await beginCatalogFact(tx, reference, actor, revision, definitionRevisionId);
		const nodes = [...catalogValueNodes(qualifier.value)];
		const appended = await appendCatalogFactNodes(
			tx,
			reference,
			actor,
			fact.revision,
			fact.id,
			-1,
			nodes,
		);
		revision = (
			await sealCatalogFact(
				tx,
				reference,
				actor,
				appended.revision,
				fact.id,
				appended.lastNodePosition,
			)
		).revision;
		qualifiers.push({ definitionRevisionId, valueFactId: fact.id });
		await tx.insert(CatalogFactTables[reference.owner].support).values({
			ownerId: reference.id,
			factId: fact.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `/${qualifier.key}`,
		});
	}
	const input = {
		definitionRevisionId: mapping.predicateRevisionId,
		participants,
		qualifiers,
		spoiler: plan.spoiler,
	};
	const relation = await createCatalogRelation(tx, reference, actor, revision, input);
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		ownerId: reference.id,
		relationId: relation.id,
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		sourcePath: "/",
	});
	return relation;
}
