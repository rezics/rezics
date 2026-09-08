import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { BangumiApiRelationSchemas } from "./bangumi-records";
import { BangumiApiContractSha256, resolveBangumiDependency } from "./bangumi-adoption";
import { type CatalogReference } from "./contracts";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import {
	appendCatalogFactNodes,
	beginCatalogFact,
	createCatalogRelation,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";

/** Exact API endpoint vocabulary; archive relationship files have separate contracts. @internal */
export const BangumiApiRelationKindSchema = z.enum([
	"subject_persons",
	"subject_subjects",
	"subject_characters",
	"person_subjects",
	"character_subjects",
	"person_characters",
	"character_persons",
]);
type Participant = {
	role: "subject" | "related_subject" | "person" | "character";
	objectType: "subject" | "person" | "character";
	id: number;
};

/** Character cast rows require the subject, actor, and character; the actor never becomes a property of the character. @internal */
export function planBangumiApiRelation(
	kind: z.input<typeof BangumiApiRelationKindSchema>,
	input: unknown,
	originId: number,
	actorIndex?: number,
) {
	const endpoint = BangumiApiRelationKindSchema.parse(kind);
	z.number().int().positive().parse(originId);
	if (actorIndex !== undefined) z.number().int().min(0).parse(actorIndex);
	const row = BangumiApiRelationSchemas[endpoint].parse(input);
	const participants: Participant[] = [];
	switch (endpoint) {
		case "subject_persons":
			participants.push(
				{ role: "subject", objectType: "subject", id: originId },
				{ role: "person", objectType: "person", id: row.id },
			);
			break;
		case "subject_subjects":
			participants.push(
				{ role: "subject", objectType: "subject", id: originId },
				{ role: "related_subject", objectType: "subject", id: row.id },
			);
			break;
		case "subject_characters": {
			participants.push(
				{ role: "subject", objectType: "subject", id: originId },
				{ role: "character", objectType: "character", id: row.id },
			);
			if (actorIndex !== undefined) {
				const actor = "actors" in row ? row.actors[actorIndex] : undefined;
				if (!actor) throw new RangeError("Contextual cast member does not exist");
				participants.push({ role: "person", objectType: "person", id: actor.id });
			}
			break;
		}
		case "person_subjects":
			participants.push(
				{ role: "person", objectType: "person", id: originId },
				{ role: "subject", objectType: "subject", id: row.id },
			);
			break;
		case "character_subjects":
			participants.push(
				{ role: "character", objectType: "character", id: originId },
				{ role: "subject", objectType: "subject", id: row.id },
			);
			break;
		case "person_characters":
		case "character_persons": {
			if (!("subject_id" in row)) throw new TypeError("Contextual relation is missing its subject");
			const personOrigin = endpoint === "person_characters";
			participants.push(
				{
					role: personOrigin ? "person" : "character",
					objectType: personOrigin ? "person" : "character",
					id: originId,
				},
				{
					role: personOrigin ? "character" : "person",
					objectType: personOrigin ? "character" : "person",
					id: row.id,
				},
				{ role: "subject", objectType: "subject", id: row.subject_id },
			);
			break;
		}
	}
	if (actorIndex !== undefined && endpoint !== "subject_characters")
		throw new TypeError("This endpoint has no nested cast members");
	return {
		participants,
		roleLabel: "relation" in row ? row.relation : row.staff,
		rolePath: "relation" in row ? "relation" : "staff",
		appearEps: "eps" in row ? row.eps : undefined,
	};
}

/** Adopt one reviewed endpoint relation; page bytes and the origin route identity remain exact evidence. @internal */
export async function adoptBangumiApiRelation(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: {
		receipt: CatalogSourceReceipt;
		bytes: Uint8Array;
		entryIndex: number;
		actorIndex?: number;
		predicateRevisionId: string;
		roles: Partial<Record<Participant["role"], string>>;
		roleDefinitionRevisionId: string;
		appearanceDefinitionRevisionId?: string;
	},
) {
	const kind = BangumiApiRelationKindSchema.parse(input.receipt.key.objectType);
	const value = z
		.object({
			entryIndex: z.number().int().min(0),
			actorIndex: z.number().int().min(0).optional(),
			predicateRevisionId: z.uuid(),
			roles: z.partialRecord(
				z.enum(["subject", "related_subject", "person", "character"]),
				z.uuid(),
			),
			roleDefinitionRevisionId: z.uuid(),
			appearanceDefinitionRevisionId: z.uuid().optional(),
		})
		.parse(input);
	if (
		input.receipt.key.source !== "bangumi" ||
		input.receipt.contractSha256 !== BangumiApiContractSha256 ||
		input.bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(input.bytes).digest("hex") !== input.receipt.contentSha256
	)
		throw new TypeError("Relationship page differs from its immutable receipt");
	const rows = z
		.array(z.unknown())
		.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(input.bytes)));
	const originId = z.coerce.number().int().positive().parse(input.receipt.key.externalId);
	const plan = planBangumiApiRelation(kind, rows[value.entryIndex], originId, value.actorIndex);
	const observation = await recordCatalogSourceDocument(tx, input.receipt, input.bytes);
	const participants = [];
	for (const participant of plan.participants) {
		const roleRevisionId = value.roles[participant.role];
		if (!roleRevisionId) throw new TypeError(`Missing governed role ${participant.role}`);
		participants.push({
			roleRevisionId,
			target: await resolveBangumiDependency(tx, actor, participant.objectType, participant.id),
		});
	}
	const owner = participants[0]?.target;
	if (!owner || owner.owner !== reference.owner || owner.id !== reference.id)
		throw new TypeError("Relationship page belongs to another native owner");
	const scalarQualifiers = [
		{
			definitionRevisionId: value.roleDefinitionRevisionId,
			value: plan.roleLabel,
			path: plan.rolePath,
		},
	];
	if (plan.appearEps !== undefined) {
		if (!value.appearanceDefinitionRevisionId)
			throw new TypeError("Episode participation requires a governed appearance qualifier");
		scalarQualifiers.push({
			definitionRevisionId: value.appearanceDefinitionRevisionId,
			value: plan.appearEps,
			path: "eps",
		});
	}
	let revision = expectedRevision;
	const qualifiers = [];
	for (const qualifier of scalarQualifiers) {
		const fact = await beginCatalogFact(
			tx,
			reference,
			actor,
			revision,
			qualifier.definitionRevisionId,
			{ purpose: "qualifier" },
		);
		const appended = await appendCatalogFactNodes(
			tx,
			reference,
			actor,
			fact.revision,
			fact.id,
			-1,
			[...catalogValueNodes(qualifier.value)],
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
		qualifiers.push({ definitionRevisionId: qualifier.definitionRevisionId, valueFactId: fact.id });
		await tx
			.insert(CatalogFactTables[reference.owner].support)
			.values({
				ownerId: reference.id,
				factId: fact.id,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: `/${value.entryIndex}/${qualifier.path}`,
			});
	}
	const relation = await createCatalogRelation(tx, reference, actor, revision, {
		definitionRevisionId: value.predicateRevisionId,
		participants,
		qualifiers,
	});
	await tx
		.insert(CatalogFactTables[reference.owner].support)
		.values({
			ownerId: reference.id,
			relationId: relation.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `/${value.entryIndex}`,
		});
	return relation;
}
