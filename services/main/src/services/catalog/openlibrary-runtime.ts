import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "./contracts";
import {
	OpenLibraryContractSha256,
	OpenLibraryDocumentSchema,
	openLibrarySourceKey,
	openLibraryDate,
	type OpenLibraryDocument,
} from "./openlibrary";
import {
	openLibraryContributors,
	openLibraryFacts,
	openLibraryPhysicalFormat,
	type OpenLibraryContributor,
} from "./openlibrary-plans";
import type { CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { bindReferencedSourceIdentity } from "./source-references";
import { initializeEntityProfile } from "./entities";
import { updatePublishingStructure } from "./publishing";
import { ensureCatalogDefinition } from "./storage";
import type { CatalogSourceFactResult } from "./source-fact-delta";
import type { CatalogSourceRelationDescriptor } from "./source-relation-delta";
import type { NativeChildValue } from "./child-source-contracts";
import { catalogSourceRecordId } from "./source-record-key";
import { prepareCatalogSourceProposalDependency } from "./source-dependencies";

export type OpenLibraryArchive = { receipt: CatalogSourceReceipt; bytes: Uint8Array };
export type OpenLibraryObservedDocument = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
export function prepareOpenLibraryArchive(archive: OpenLibraryArchive): OpenLibraryDocument {
	const { receipt, bytes } = archive;
	if (
		receipt.key.source !== "openlibrary" ||
		receipt.contractSha256 !== OpenLibraryContractSha256 ||
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError(
			"OpenLibrary bytes or reviewed contract differ from their archived receipt",
		);
	const parsed = OpenLibraryDocumentSchema.parse({
		kind: receipt.key.objectType,
		record: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	});
	const key = openLibrarySourceKey(parsed.record.key);
	if (key.objectType !== receipt.key.objectType || key.externalId !== receipt.key.externalId)
		throw new TypeError("OpenLibrary record differs from its archived source identity");
	return parsed;
}
export function openLibraryReferences(record: OpenLibraryDocument) {
	const references: Array<{
		key: string;
		path: string;
		owner: "publishing" | "entity";
		shape: "work" | "unresolved";
	}> = openLibraryContributors(record).map((contributor) => ({
		key: contributor.key,
		path: contributor.path,
		owner: "entity",
		shape: "unresolved",
	}));
	if (record.kind === "edition")
		record.record.works?.forEach((value, index) =>
			references.push({
				key: value.key,
				path: `/works/${index}/key`,
				owner: "publishing",
				shape: "work",
			}),
		);
	for (const reference of references) {
		const key = openLibrarySourceKey(reference.key);
		if (key.objectType !== (reference.owner === "publishing" ? "work" : "author"))
			throw new TypeError("OpenLibrary dependency has another bibliographic grain");
	}
	if (references.length > 128) throw new RangeError("OpenLibrary references require staged intake");
	return references;
}
/** @internal New dependencies are admitted only in separately authorized intake; proposal callbacks are read-only toward them. */
export async function resolveOpenLibraryReferences(
	tx: DatabaseTransaction,
	actor: string,
	document: OpenLibraryObservedDocument,
	record: OpenLibraryDocument,
	mode: "intake" | "prepared",
) {
	const result = new Map<string, CatalogReference>();
	for (const ref of openLibraryReferences(record)) {
		if (result.has(ref.key)) continue;
		const key = openLibrarySourceKey(ref.key);
		const native = await bindReferencedSourceIdentity(tx, actor, {
			...key,
			owner: ref.owner,
			shape: ref.shape,
			evidence: document.referenceAt(ref.path),
			mode,
			initialize: async (identity) => {
				const initialized =
					identity.owner === "publishing"
						? await updatePublishingStructure(tx, identity, actor, identity.revision, {
								shape: "work",
								fields: {},
							})
						: await initializeEntityProfile(tx, identity, actor, identity.revision, {});
				return { ...identity, revision: initialized.revision };
			},
		});
		result.set(ref.key, { owner: native.owner, id: native.id });
	}
	return result;
}
/** @internal Share incoming and exact previous evidence with one proposal; source visibility never grants Auth control. */
export async function prepareOpenLibraryProposalDependencies(
	tx: DatabaseTransaction,
	actor: string,
	input: {
		sourceRecordId: string;
		proposalId: string;
		before?: { document: OpenLibraryObservedDocument; record: OpenLibraryDocument };
		after: { document: OpenLibraryObservedDocument; record: OpenLibraryDocument };
	},
) {
	const sources = [
		{ ...input.after, purpose: "incoming" as const },
		...(input.before ? [{ ...input.before, purpose: "previous-for-withdrawal" as const }] : []),
	];
	const all = sources.flatMap((source) =>
		openLibraryReferences(source.record).map((reference) => ({ source, reference })),
	);
	if (all.length > 128)
		throw new RangeError("OpenLibrary proposal dependencies require staged admission");
	let position = 0;
	for (const source of sources) {
		await resolveOpenLibraryReferences(
			tx,
			actor,
			source.document,
			source.record,
			source.purpose === "incoming" ? "intake" : "prepared",
		);
		for (const reference of openLibraryReferences(source.record))
			await prepareCatalogSourceProposalDependency(tx, actor, {
				sourceRecordId: input.sourceRecordId,
				proposalId: input.proposalId,
				position: position++,
				dependencySourceRecordId: catalogSourceRecordId(openLibrarySourceKey(reference.key)),
				evidence: source.document.referenceAt(reference.path),
				purpose: source.purpose,
			});
	}
	return { count: position };
}
const resourceTargets = [
	{
		owner: "publishing" as const,
		shapes: ["work", "text_version", "publication", "serialization"],
	},
];
const contributorTargets = [
	{
		owner: "entity" as const,
		shapes: ["person", "organization", "collective", "character", "unresolved"],
	},
];
export async function openLibraryCreditDefinitions(tx: DatabaseTransaction) {
	const resource = await ensureCatalogDefinition(tx, {
		namespace: "catalog.bibliographic_role",
		key: "resource",
		kind: "role",
		valueKind: null,
		constraints: { targets: resourceTargets },
	});
	const contributor = await ensureCatalogDefinition(tx, {
		namespace: "catalog.bibliographic_role",
		key: "contributor",
		kind: "role",
		valueKind: null,
		constraints: { targets: contributorTargets },
	});
	const order = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "bibliographic-credit-order",
		kind: "property",
		valueKind: "number",
		constraints: { integer: true, minimum: 0 },
	});
	const role = await ensureCatalogDefinition(tx, {
		namespace: "catalog",
		key: "bibliographic-credit-role-statement",
		kind: "property",
		valueKind: "string",
		constraints: { maxLength: 131072 },
	});
	const predicate = await ensureCatalogDefinition(tx, {
		namespace: "catalog.bibliographic_relation",
		key: "contribution",
		kind: "predicate",
		valueKind: null,
		constraints: {
			roles: [
				{ roleRevisionId: resource.revisionId, min: 1, max: 1, targets: resourceTargets },
				{ roleRevisionId: contributor.revisionId, min: 1, max: 1, targets: contributorTargets },
			],
			qualifierRevisionIds: [order.revisionId, role.revisionId],
		},
	});
	return {
		resource: resource.revisionId,
		contributor: contributor.revisionId,
		order: order.revisionId,
		role: role.revisionId,
		predicate: predicate.revisionId,
	};
}
export const contributionPath = (contributor: OpenLibraryContributor) =>
	contributor.path.replace(/\/(?:author\/)?key$/u, "");
export async function openLibraryFactPlan(tx: DatabaseTransaction, record: OpenLibraryDocument) {
	const facts = await openLibraryFacts(tx, record),
		contributors = openLibraryContributors(record);
	if (contributors.length) {
		const definitions = await openLibraryCreditDefinitions(tx);
		for (const contributor of contributors) {
			facts.push({
				definitionRevisionId: definitions.order,
				kind: "number",
				value: contributor.position,
				identity: `${contributor.identity}/order`,
				path: contributionPath(contributor),
			});
			if (contributor.role !== null)
				facts.push({
					definitionRevisionId: definitions.role,
					kind: "string",
					value: contributor.role,
					identity: `${contributor.identity}/role`,
					path: `${contributionPath(contributor)}/role`,
				});
		}
	}
	return facts;
}
export async function openLibraryRelationPlan(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	record: OpenLibraryDocument,
	targets: ReadonlyMap<string, CatalogReference>,
	facts: readonly CatalogSourceFactResult[],
): Promise<CatalogSourceRelationDescriptor[]> {
	const contributors = openLibraryContributors(record);
	if (!contributors.length) return [];
	const definitions = await openLibraryCreditDefinitions(tx),
		factByIdentity = new Map(facts.map((fact) => [fact.identity, fact]));
	return contributors.map((contributor) => {
		const target = targets.get(contributor.key),
			order = factByIdentity.get(`${contributor.identity}/order`),
			role = factByIdentity.get(`${contributor.identity}/role`);
		if (!target || !order || (contributor.role !== null && !role))
			throw new Error("OpenLibrary credit lacks its exact prepared target or qualifier fact");
		return {
			identity: contributor.identity,
			path: contributionPath(contributor),
			value: {
				definitionRevisionId: definitions.predicate,
				participants: [
					{ roleRevisionId: definitions.resource, target: reference },
					{
						roleRevisionId: definitions.contributor,
						target,
						...(contributor.creditedAs !== null ? { creditedAs: contributor.creditedAs } : {}),
					},
				],
				qualifiers: [
					{ definitionRevisionId: definitions.order, valueFactId: order.factId },
					...(role ? [{ definitionRevisionId: definitions.role, valueFactId: role.factId }] : []),
				],
				spoiler: 0,
			},
		};
	});
}
function sourceChildId(sourceRecordId: string, key: string) {
	const hash = createHash("sha256")
		.update(`openlibrary-child.2\0${sourceRecordId}\0${key}`)
		.digest("hex");
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
export type OpenLibraryChildPlan = {
	key: string;
	path: string;
	value: NativeChildValue;
	observedFields: string[];
};
/** Source tables of contents remain structured bibliographic assertions, not invented serial identities. */
export async function openLibraryChildPlan(
	tx: DatabaseTransaction,
	sourceRecordId: string,
	record: OpenLibraryDocument,
	targets: ReadonlyMap<string, CatalogReference>,
): Promise<OpenLibraryChildPlan[]> {
	if (record.kind !== "edition") return [];
	const children: OpenLibraryChildPlan[] = [],
		seen = new Set<string>();
	for (const [index, work] of (record.record.works ?? []).entries()) {
		const target = targets.get(work.key);
		if (!target || target.owner !== "publishing")
			throw new Error("Publication Work dependency was not prepared");
		if (seen.has(target.id)) continue;
		seen.add(target.id);
		children.push({
			key: target.id,
			path: `/works/${index}/key`,
			value: { kind: "publication_work", targetId: target.id, position: index, coverageText: null },
			observedFields: ["targetId", "position"],
		});
	}
	const publishers = record.record.publishers ?? [],
		date = openLibraryDate(record.record.publish_date) ?? { year: null, month: null, day: null };
	if (record.record.publish_date || publishers.length === 1)
		children.push({
			key: sourceChildId(sourceRecordId, "release-event"),
			path: "/",
			value: {
				kind: "event",
				publisherEntityId: null,
				publisherCredit: publishers.length === 1 ? (publishers[0] ?? null) : null,
				areaId: null,
				date,
				dateText: record.record.publish_date ?? null,
			},
			observedFields: ["publisherCredit", "date", "dateText"],
		});
	const format = openLibraryPhysicalFormat(record.record.physical_format);
	if (format) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "catalog.publication_format",
			key: format,
			kind: "vocabulary",
			valueKind: null,
			constraints: {
				targets: [{ owner: "publishing", shapes: ["publication"] }],
				slots: ["facet"],
			},
		});
		children.push({
			key: definition.revisionId,
			path: "/physical_format",
			value: { kind: "facet", definitionRevisionId: definition.revisionId },
			observedFields: ["definitionRevisionId"],
		});
	}
	return children;
}
