import { catalogSourcePath } from "./source-document-scope";
import { MusicBrainzRelationEndpointFamilies } from "./musicbrainz-relation-plan";
import { catalogReferenceAwareSupportColumns } from "./source-support";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import type { CatalogReference } from "./contracts";
import { MusicBrainzRelationSchema, musicBrainzDate } from "./musicbrainz";
import { bindReferencedSourceIdentity } from "./source-references";
import type { recordCatalogSourceDocument } from "./source-observations";
import {
	appendCatalogFactNodes,
	beginCatalogFact,
	createCatalogRelation,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";

type Relation = z.infer<typeof MusicBrainzRelationSchema>;
type Observation = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
async function attributeDefinition(tx: DatabaseTransaction) {
	return ensureCatalogDefinition(tx, {
		namespace: "musicbrainz.relationship.qualifier",
		key: "attributes",
		kind: "property",
		valueKind: "array",
		constraints: {
			rules: [
				{ position: 0, parent: null, memberKey: null, kind: "array" },
				{ position: 1, parent: 0, memberKey: null, kind: "object" },
				{ position: 2, parent: 1, memberKey: "name", kind: "string", maxLength: 131072 },
				{ position: 3, parent: 1, memberKey: "id", kind: "string", nullable: true, maxLength: 36 },
				{
					position: 4,
					parent: 1,
					memberKey: "value",
					kind: "string",
					nullable: true,
					maxLength: 131072,
				},
				{
					position: 5,
					parent: 1,
					memberKey: "credit",
					kind: "string",
					nullable: true,
					maxLength: 131072,
				},
			],
		},
	});
}

/** @alpha Canonical relation direction and credit qualifiers survive provider adoption. */
export async function adoptMusicBrainzRelations(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	expectedRevision: number,
	observation: Observation,
	input: readonly Relation[],
	path = "/relations",
	sourceOffset = 0,
	replacement?: { semanticId: string; expectedHeadVersion: number },
	dependencyMode: "intake" | "prepared" = "intake",
) {
	const relations = z.array(MusicBrainzRelationSchema).max(8192).parse(input);
	z.number().int().min(0).max(8191).parse(sourceOffset);
	if (sourceOffset + relations.length > 8192 || (replacement && relations.length !== 1))
		throw new TypeError("Relationship replacement requires one exact source occurrence");
	if (!relations.length) return expectedRevision;
	const identity = await loadCatalogIdentity(tx, reference, actor, true);
	const sourceRole = await ensureCatalogDefinition(tx, {
		namespace: "musicbrainz.relationship",
		key: "source",
		kind: "role",
		valueKind: null,
	});
	const targetRole = await ensureCatalogDefinition(tx, {
		namespace: "musicbrainz.relationship",
		key: "target",
		kind: "role",
		valueKind: null,
	});
	let revision = expectedRevision;
	for (const [index, relation] of relations.entries()) {
		const position = sourceOffset + index;
		const key =
			relation["target-type"] === "release_group" ? "release-group" : relation["target-type"];
		const target = relation[key];
		if (!target) throw new TypeError("Relationship target missing");
		const family = MusicBrainzRelationEndpointFamilies[key];
		const endpoint = await bindReferencedSourceIdentity(tx, actor, {
			mode: dependencyMode,
			source: "musicbrainz",
			objectType: key.replaceAll("-", "_"),
			externalId: target.id,
			owner: family.owner,
			shape: family.shape,
			name:
				"name" in target && typeof target.name === "string"
					? target.name
					: "title" in target && typeof target.title === "string"
						? target.title
						: undefined,
			evidence: observation.referenceAt(`${path}/${position}/${key}/id`),
		});
		const scalarQualifiers: {
			key: string;
			kind: "string" | "number" | "boolean";
			value: string | number | boolean | null;
		}[] = [];
		for (const part of ["begin", "end"] as const)
			if (relation[part] !== undefined) {
				const date = musicBrainzDate(relation[part]);
				for (const component of ["year", "month", "day"] as const)
					scalarQualifiers.push({
						key: `${part}.${component}`,
						kind: "number",
						value: date[component],
					});
			}
		if (relation.ended !== undefined)
			scalarQualifiers.push({ key: "ended", kind: "boolean", value: relation.ended });
		if (relation["ordering-key"] !== undefined)
			scalarQualifiers.push({ key: "ordering", kind: "number", value: relation["ordering-key"] });
		const attributeNames = new Set([
			...(relation.attributes ?? []),
			...Object.keys(relation["attribute-ids"] ?? {}),
			...Object.keys(relation["attribute-values"] ?? {}),
			...Object.keys(relation["attribute-credits"] ?? {}),
		]);
		// One typed attribute fact retains identity, display name, credited form and text together.
		const attributes = [...attributeNames].map((name) => ({
			name,
			id: relation["attribute-ids"]?.[name] ?? null,
			value: relation["attribute-values"]?.[name] ?? null,
			credit: relation["attribute-credits"]?.[name] ?? null,
		}));
		const qualifiers: { definitionRevisionId: string; valueFactId: string }[] = [];
		for (const qualifier of scalarQualifiers) {
			const definition = await ensureCatalogDefinition(tx, {
				namespace: "musicbrainz.relationship.qualifier",
				key: qualifier.key,
				kind: "property",
				valueKind: qualifier.kind,
				constraints: { nullable: true, ...(qualifier.kind === "number" ? { integer: true } : {}) },
			});
			const fact = await beginCatalogFact(tx, reference, actor, revision, definition.revisionId, { purpose: "qualifier" });
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
			qualifiers.push({ definitionRevisionId: definition.revisionId, valueFactId: fact.id });
		}
		if (attributes.length) {
			const definition = await attributeDefinition(tx);
			const fact = await beginCatalogFact(tx, reference, actor, revision, definition.revisionId, { purpose: "qualifier" });
			revision = fact.revision;
			let lastPosition = -1;
			const nodes = [...catalogValueNodes(attributes)];
			for (let offset = 0; offset < nodes.length; offset += 512) {
				const appended = await appendCatalogFactNodes(
					tx,
					reference,
					actor,
					revision,
					fact.id,
					lastPosition,
					nodes.slice(offset, offset + 512),
				);
				revision = appended.revision;
				lastPosition = appended.lastNodePosition;
			}
			revision = (await sealCatalogFact(tx, reference, actor, revision, fact.id, lastPosition))
				.revision;
			qualifiers.push({ definitionRevisionId: definition.revisionId, valueFactId: fact.id });
		}
		const sourceEndpoint = relation.direction === "forward" ? reference : endpoint;
		const targetEndpoint = relation.direction === "forward" ? endpoint : reference;
		const ownerTarget = {
			owner: reference.owner,
			shapes:
				reference.owner === "entity"
					? ["person", "collective", "character", "label", "organization", "unresolved"]
					: [identity.shape],
		};
		const otherTarget = {
			owner: family.owner,
			shapes:
				family.owner === "entity"
					? ["person", "collective", "character", "label", "organization", "unresolved"]
					: [...family.shapes],
		};
		const qualifierRevisionIds = [(await attributeDefinition(tx)).revisionId];
		for (const key of [
			"begin.year",
			"begin.month",
			"begin.day",
			"end.year",
			"end.month",
			"end.day",
			"ended",
			"ordering",
		])
			qualifierRevisionIds.push(
				(
					await ensureCatalogDefinition(tx, {
						namespace: "musicbrainz.relationship.qualifier",
						key,
						kind: "property",
						valueKind: key === "ended" ? "boolean" : "number",
						constraints: { nullable: true, ...(key !== "ended" ? { integer: true } : {}) },
					})
				).revisionId,
			);
		const predicate = await ensureCatalogDefinition(tx, {
			namespace: "musicbrainz.relationship",
			key: `${relation["type-id"]}.${sourceEndpoint.owner}.${targetEndpoint.owner}`,
			kind: "predicate",
			valueKind: null,
			constraints: {
				roles: [
					{
						roleRevisionId: sourceRole.revisionId,
						min: 1,
						max: 1,
						targets: [relation.direction === "forward" ? ownerTarget : otherTarget],
					},
					{
						roleRevisionId: targetRole.revisionId,
						min: 1,
						max: 1,
						targets: [relation.direction === "forward" ? otherTarget : ownerTarget],
					},
				],
				qualifierRevisionIds,
			},
		});
		const created = await createCatalogRelation(tx, reference, actor, revision, {
			...replacement,
			definitionRevisionId: predicate.revisionId,
			participants: [
				{
					roleRevisionId: sourceRole.revisionId,
					target: sourceEndpoint,
					creditedAs:
						(relation.direction === "forward"
							? relation["source-credit"]
							: relation["target-credit"]) ?? undefined,
				},
				{
					roleRevisionId: targetRole.revisionId,
					target: targetEndpoint,
					creditedAs:
						(relation.direction === "forward"
							? relation["target-credit"]
							: relation["source-credit"]) ?? undefined,
				},
			],
			qualifiers,
		});
		revision = created.revision;
		for (const qualifier of qualifiers)
			await tx.insert(CatalogFactTables[reference.owner].support).values({
				...(await catalogReferenceAwareSupportColumns(tx, observation.record.id)),
				ownerId: reference.id,
				factId: qualifier.valueFactId,
				sourceRecordId: observation.record.id,
				snapshotId: observation.snapshot.id,
				sourcePath: catalogSourcePath(observation.record.id, observation.snapshot.id, `${path}/${position}`),
			});
		await tx.insert(CatalogFactTables[reference.owner].support).values({
			...(await catalogReferenceAwareSupportColumns(tx, observation.record.id)),
			ownerId: reference.id,
			relationId: created.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: catalogSourcePath(observation.record.id, observation.snapshot.id, `${path}/${position}`),
		});
	}
	return revision;
}
