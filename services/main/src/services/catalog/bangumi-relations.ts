import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "@rezics/schema/contracts/native/catalog";
import { BangumiArchiveRelationSchema, bangumiRelationKey } from "./bangumi-records";
import type { CatalogSourceReceipt } from "./source-observations";

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
	if (row.kind === "person-relations" && (row.person_id === 0 || row.related_person_id === 0))
		throw new BangumiUnresolvedSourceReference(bangumiRelationKey(row));
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
			qualifiers.push({ key: "type", value: row.type }, { key: "summary", value: row.summary });
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

/** The public dump includes dangling zero-ID relations; they remain unresolved evidence, never invented native entities. @internal */
export class BangumiUnresolvedSourceReference extends Error {
	readonly code = "bangumi.unresolved_source_reference";
	constructor(readonly sourceTuple: string) {
		super(`Bangumi source relation has a missing endpoint: ${sourceTuple}`);
	}
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
	const { initializeBangumiNativeRelation } = await import("./bangumi-relation-native");
	return initializeBangumiNativeRelation(
		tx,
		reference,
		actor,
		expectedRevision,
		receipt,
		bytes,
		mappingInput,
	);
}
