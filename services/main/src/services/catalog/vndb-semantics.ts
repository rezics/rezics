import { catalogSourceSupportColumns } from "./source-support";
import {
	planVndbSupportingNames,
	planVndbSupportingSemantics,
	vndbCharacterPropertyDefinitions,
} from "./vndb-supporting-plans";
import { initializeVndbNativeNames } from "./vndb-names-update";
import {
	prepareCatalogSourceChildCorrespondence,
	resolveCatalogSourceChildCorrespondence,
	type CatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { CatalogSourceNativeChange } from "./source-applications";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import type { CatalogOwner, CatalogReference } from "./contracts";
import { bindReferencedSourceIdentity } from "./source-references";
import { inspectExistingSourceBinding } from "./source-adoption";
import { recordCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import {
	appendCatalogFactNodes,
	beginCatalogFact,
	createCatalogIdentity,
	createCatalogRelation,
	ensureCatalogDefinition,
	loadCatalogIdentity,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";
import { VndbCatalogContractSha256, VndbDumpContractSha256 } from "./vndb";
import { normalizeVndbSemanticDump } from "./vndb-semantics-dump";
import {
	planVndbSemantics,
	VndbHierarchyEdgeSchema,
	VndbSemanticObjectSchema,
	type VndbSemanticFact,
	type VndbSemanticPlan,
	type VndbSemanticRelation,
} from "./vndb-semantics-contracts";

type Document = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;
type TargetRule = { owner: CatalogOwner; shapes: string[] };
const subjectTargets: TargetRule[] = [
	{ owner: "software", shapes: ["content", "release", "engine"] },
	{
		owner: "entity",
		shapes: ["person", "organization", "collective", "character", "unresolved"],
	},
	{
		owner: "reference",
		shapes: ["concept", "quotation", "image", "access-mechanism"],
	},
];
const roleTargets: Record<string, TargetRule[]> = {
	subject: subjectTargets,
	producer: [
		{
			owner: "entity",
			shapes: ["person", "organization", "collective", "unresolved"],
		},
	],
	image: [{ owner: "reference", shapes: ["image"] }],
	content: [{ owner: "software", shapes: ["content"] }],
	release: [{ owner: "software", shapes: ["release"] }],
	concept: [{ owner: "reference", shapes: ["concept"] }],
	character: [{ owner: "entity", shapes: ["character"] }],
	mechanism: [{ owner: "reference", shapes: ["access-mechanism"] }],
	engine: [{ owner: "software", shapes: ["engine"] }],
	related: [
		{ owner: "software", shapes: ["content"] },
		{
			owner: "entity",
			shapes: ["person", "organization", "collective", "unresolved"],
		},
	],
};
const scalarDefinitions: VndbSemanticFact[] = [
	...vndbCharacterPropertyDefinitions,
	...[
		"description.vndb-markup",
		"url",
		"link-label",
		"image-purpose",
		"image-url",
		"image-thumbnail",
		"character-role",
		"quotation-text",
		"access-mechanism-description",
		"engine-description",
		"primary-language",
		"playtime-estimator",
		"playtime-basis",
		"playtime-rough-category",
		"access-mechanism-note",
		"story-animation-summary",
		"erotic-animation-summary",
	].map((key) => ({
		namespace: "catalog.metadata" as const,
		key,
		kind: "string" as const,
		value: null,
		path: "/",
	})),
	...[
		"playtime-estimate-minutes",
		"playtime-sample-count",
		"image-dims-width",
		"image-dims-height",
		"image-thumbnail_dims-width",
		"image-thumbnail_dims-height",
	].map((key) => ({
		namespace: "catalog.metadata" as const,
		key,
		kind: "number" as const,
		value: null,
		path: "/",
	})),
	...[
		"background-effects",
		"animated-facial-features",
		"is-photograph",
		"image-all-release-languages",
		"requires-disc-check",
		"requires-product-key",
		"requires-online-activation",
		"limits-activations",
		"requires-account",
		"requires-continuous-network",
		"cloud-streamed",
		"requires-physical-token",
	].map((key) => ({
		namespace: "catalog.metadata" as const,
		key,
		kind: "boolean" as const,
		value: null,
		path: "/",
	})),
	...["tag-rating", "image-sexual", "image-violence"].map((key) => ({
		namespace: "source.vndb.statistics" as const,
		key,
		kind: "number" as const,
		value: null,
		path: "/",
	})),
	...[
		"external-site",
		"external-identifier",
		"image-type",
		"image-source-language",
		"relation-code",
		"taxonomy-category",
	].map((key) => ({
		namespace: "source.vndb.qualifier" as const,
		key,
		kind: "string" as const,
		value: null,
		path: "/",
	})),
	...[
		"claimed-official",
		"known-false",
		"main-parent",
		"taxonomy-searchable",
		"taxonomy-applicable",
		"taxonomy-sexual",
	].map((key) => ({
		namespace: "source.vndb.qualifier" as const,
		key,
		kind: "boolean" as const,
		value: null,
		path: "/",
	})),
	...["taxonomy-default-spoiler", "taxonomy-group-order", "spoiler-level"].map((key) => ({
		namespace: "source.vndb.qualifier" as const,
		key,
		kind: "number" as const,
		value: null,
		path: "/",
	})),
];

function propertyConstraints(item: VndbSemanticFact) {
	if (item.constraints) return item.constraints;
	if (item.kind === "string") return { nullable: true, maxLength: 131_072 };
	if (item.kind === "boolean") return { nullable: true };
	if (["image-sexual", "image-violence"].includes(item.key))
		return { nullable: true, minimum: 0, maximum: 2 };
	if (item.key === "tag-rating") return { nullable: true, minimum: 0, maximum: 3 };
	if (["taxonomy-default-spoiler", "spoiler-level"].includes(item.key))
		return { nullable: true, integer: true, minimum: 0, maximum: 2 };
	return {
		nullable: true,
		integer: true,
		minimum: item.key === "taxonomy-group-order" ? -32768 : 0,
		maximum: Number.MAX_SAFE_INTEGER,
	};
}

/**
 * @alpha Register the reviewed semantic vocabulary, independent of any imported record.
 * @remarks The vocabulary has fewer than 96 scalar definitions. A request-local map avoids
 * repeated definition lookups per occurrence without a process-global database cache.
 */
async function semanticDefinitions(tx: DatabaseTransaction) {
	const definitions = new Map<string, string>();
	for (const item of scalarDefinitions) {
		const input = {
			namespace: item.namespace,
			key: item.key,
			kind: "property" as const,
			valueKind: item.kind,
			constraints: propertyConstraints(item),
		};
		const definition = await ensureCatalogDefinition(tx, input);
		definitions.set(`${item.namespace}:${item.key}`, definition.revisionId);
	}
	const roles = new Map<string, string>();
	for (const [key, targets] of Object.entries(roleTargets)) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "catalog.semantic-role",
			key,
			kind: "role",
			valueKind: null,
			...{ constraints: { targets } },
		});
		roles.set(key, definition.revisionId);
	}
	return { definitions, roles };
}

function mustGet(map: ReadonlyMap<string, string>, key: string) {
	const value = map.get(key);
	if (!value) throw new TypeError(`Unregistered reviewed VNDB semantic definition: ${key}`);
	return value;
}

async function appendFact(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	item: VndbSemanticFact,
	definitionId: string,
	document: Document,
	sourceKey: string,
	scope: CatalogSourceChildCorrespondence,
	replacement?: { semanticId: string; headVersion: number },
) {
	const fact = await beginCatalogFact(tx, reference, actor, revision, definitionId, {
		spoiler: item.spoiler ?? 0,
		...(replacement
			? {
					semanticId: replacement.semanticId,
					expectedHeadVersion: replacement.headVersion,
				}
			: {}),
	});
	const appended = await appendCatalogFactNodes(tx, reference, actor, fact.revision, fact.id, -1, [
		...catalogValueNodes(item.value),
	]);
	const sealed = await sealCatalogFact(
		tx,
		reference,
		actor,
		appended.revision,
		fact.id,
		appended.lastNodePosition,
	);
	await tx.insert(CatalogFactTables[reference.owner].support).values({
		...(await catalogSourceSupportColumns(tx, document.record.id)),
		id: vndbSemanticSupportId(document, sourceKey, scope),
		ownerId: reference.id,
		factId: fact.id,
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		sourcePath: item.path,
	});
	return {
		id: fact.id,
		revision: sealed.revision,
		semanticId: sealed.semanticId,
		headVersion: sealed.headVersion,
	};
}

function allowedRoles(relation: VndbSemanticRelation) {
	if (relation.key === "supersedes-release") return ["subject", "release"];
	if (
		relation.key === "developed-by" ||
		relation.key === "published-by" ||
		relation.key === "has-linked-producer-profile"
	)
		return ["subject", "producer"];
	if (relation.key === "external-link" || relation.key === "reported-playtime-estimate")
		return ["subject"];
	if (relation.key === "has-image") return ["subject", "image", "content", "release"];
	if (
		["has-subject-tag", "has-character-trait", "has-broader-concept", "has-trait-group"].includes(
			relation.key,
		)
	)
		return ["subject", "concept"];
	if (relation.key === "character-appears-in") return ["subject", "content", "release"];
	if (relation.key === "quotation-context") return ["subject", "content", "character"];
	if (relation.key === "uses-access-mechanism") return ["subject", "mechanism"];
	if (relation.key === "uses-software-engine") return ["subject", "engine"];
	return ["subject", "related"];
}

/** @internal Accepts only plans constructed by the reviewed VNDB semantic planners. */
export async function appendVndbSemanticPlan(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	plan: VndbSemanticPlan,
	document: Document,
	options: {
		replacements?: ReadonlyMap<string, { semanticId: string; headVersion: number }>;
		reuse?: ReadonlyMap<
			string,
			{
				id: string;
				semanticId: string;
				headVersion: number;
				kind: "fact" | "relation";
			}
		>;
		changes?: CatalogSourceNativeChange[];
	} = {},
) {
	if (!plan.facts.length && !plan.relations.length) return revision;
	const scope = await resolveCatalogSourceChildCorrespondence(tx, document.record.id);
	await loadCatalogIdentity(tx, reference, actor, true);
	const { definitions, roles } = await semanticDefinitions(tx);
	const keys = vndbSemanticKeys(plan);
	const writeFact = async (item: VndbSemanticFact, key: string) => {
		const reused = options.reuse?.get(key);
		if (reused) {
			if (reused.kind !== "fact") throw new TypeError("Semantic reuse family changed");
			await reuseVndbSemanticSupport(tx, reference, document, key, item.path, reused, scope);
			return reused.id;
		}
		const replacement = options.replacements?.get(key);
		const created = await appendFact(
			tx,
			reference,
			actor,
			revision,
			item,
			mustGet(definitions, `${item.namespace}:${item.key}`),
			document,
			key,
			scope,
			replacement,
		);
		revision = created.revision;
		options.changes?.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: created.semanticId,
			beforeRevision: replacement?.headVersion ?? null,
			afterRevision: created.headVersion,
		});
		return created.id;
	};
	for (const [index, item] of plan.facts.entries()) {
		const key = keys.facts[index];
		if (!key) throw new Error("Missing semantic fact key");
		await writeFact(item, key);
	}
	const targets = new Map<string, CatalogReference>();
	const predicates = new Map<string, string>();
	for (const [relationIndex, relation] of plan.relations.entries()) {
		const relationKey = keys.relations[relationIndex];
		if (!relationKey) throw new Error("Missing semantic relation key");
		if (relation.qualifiers.length > 64)
			throw new RangeError(
				"VNDB relation qualifier budget exceeded; split language scopes into bounded commands",
			);
		const qualifiers: { definitionRevisionId: string; valueFactId: string }[] = [];
		for (const [index, item] of relation.qualifiers.entries()) {
			const key = keys.qualifiers[relationIndex]?.[index];
			if (!key) throw new Error("Missing semantic qualifier key");
			const id = await writeFact(item, key);
			qualifiers.push({
				definitionRevisionId: mustGet(definitions, `${item.namespace}:${item.key}`),
				valueFactId: id,
			});
		}
		const reused = options.reuse?.get(relationKey);
		if (reused) {
			if (reused.kind !== "relation") throw new TypeError("Semantic reuse family changed");
			await reuseVndbSemanticSupport(
				tx,
				reference,
				document,
				relationKey,
				relation.path,
				reused,
				scope,
			);
			continue;
		}
		const participants = [{ roleRevisionId: mustGet(roles, "subject"), target: reference }];
		for (const participant of relation.participants) {
			const key = `${participant.target.objectType}:${participant.target.externalId}`;
			let native = targets.get(key);
			if (!native) {
				native = await bindReferencedSourceIdentity(tx, actor, {
					...participant.target,
					source: "vndb",
					evidence: document.referenceAt(participant.target.path),
				});
				targets.set(key, native);
			}
			participants.push({
				roleRevisionId: mustGet(roles, participant.role),
				target: native,
			});
		}
		let definitionRevisionId = predicates.get(relation.key);
		if (!definitionRevisionId) {
			const relationRoles = allowedRoles(relation).map((role, index) => ({
				roleRevisionId: mustGet(roles, role),
				min: index < 2 ? 1 : 0,
				max: 1,
				targets:
					relation.key === "reported-playtime-estimate"
						? [{ owner: "software" as const, shapes: ["content"] }]
						: (roleTargets[role] ?? []),
			}));
			const constraints = {
				roles: relationRoles,
				qualifierRevisionIds: scalarDefinitions
					.filter((item) => item.namespace !== "catalog")
					.map((item) => mustGet(definitions, `${item.namespace}:${item.key}`)),
			};
			const predicate = await ensureCatalogDefinition(tx, {
				namespace: "catalog.semantic-relation",
				key: relation.key,
				kind: "predicate",
				valueKind: null,
				...{ constraints },
			});
			definitionRevisionId = predicate.revisionId;
			predicates.set(relation.key, definitionRevisionId);
		}
		const replacement = options.replacements?.get(relationKey);
		const created = await createCatalogRelation(tx, reference, actor, revision, {
			definitionRevisionId,
			...(replacement
				? {
						semanticId: replacement.semanticId,
						expectedHeadVersion: replacement.headVersion,
					}
				: {}),
			participants,
			...{ qualifiers, spoiler: relation.spoiler },
		});
		revision = created.revision;
		options.changes?.push({
			kind: "catalog-semantic",
			owner: reference.owner,
			ownerId: reference.id,
			componentKey: created.semanticId,
			beforeRevision: replacement?.headVersion ?? null,
			afterRevision: created.headVersion,
		});
		await tx.insert(CatalogFactTables[reference.owner].support).values({
			...(await catalogSourceSupportColumns(tx, document.record.id)),
			id: vndbSemanticSupportId(document, relationKey, scope),
			ownerId: reference.id,
			relationId: created.id,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: relation.path,
		});
	}
	return revision;
}

/**
 * @alpha Adopt selected, schema-validated VNDB semantics onto a native owner identity.
 * @remarks Consumers use the regular paginated catalog facts/relations APIs and export;
 * source-only cached statistics remain in the archive and never become REZICS rating votes.
 */
export async function appendVndbSemantics(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	record: unknown,
	document: Document,
	sourcePath: (path: string) => string = (path) => path,
): Promise<number> {
	return appendVndbSemanticPlan(
		tx,
		reference,
		actor,
		expectedRevision,
		remapVndbSemanticPlan(planVndbSemantics(record), sourcePath),
		document,
	);
}

/** @alpha Import a single validated dump DAG edge without walking ancestors or inferring closure. */
export async function appendVndbHierarchyEdge(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: unknown,
	document: Document,
): Promise<number> {
	const edge = VndbHierarchyEdgeSchema.parse(input);
	const evidence = document.referenceAt("/id");
	if (evidence.externalId !== edge.id)
		throw new TypeError("Hierarchy subject differs from the archived edge");
	const child = await bindReferencedSourceIdentity(tx, actor, {
		source: "vndb",
		objectType: edge.id.startsWith("g") ? "tag" : "trait",
		externalId: edge.id,
		owner: "reference",
		shape: "concept",
		evidence,
	});
	if (reference.owner !== child.owner || reference.id !== child.id)
		throw new TypeError("Hierarchy subject differs from the bound child concept");
	return appendVndbSemanticPlan(
		tx,
		reference,
		actor,
		expectedRevision,
		{
			facts: [],
			relations: [
				{
					key: "has-broader-concept",
					path: "/parent",
					spoiler: 0,
					participants: [
						{
							role: "concept",
							target: {
								owner: "reference",
								shape: "concept",
								objectType: edge.parent.startsWith("g") ? "tag" : "trait",
								externalId: edge.parent,
								path: "/parent",
							},
						},
					],
					qualifiers: [
						{
							namespace: "source.vndb.qualifier",
							key: "main-parent",
							kind: "boolean",
							value: edge.main,
							path: "/main",
						},
					],
				},
			],
		},
		document,
	);
}

/** @alpha Exact dump foreign keys for release DRM and engine dependencies. */
export async function appendVndbReleaseTechnology(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: { kind: "drm" | "engine"; id: number; path: string },
	document: Document,
): Promise<number> {
	const value = z
		.strictObject({
			kind: z.enum(["drm", "engine"]),
			id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
			path: z.string().startsWith("/").max(512),
		})
		.parse(input);
	if (document.referenceAt(value.path).externalId !== String(value.id))
		throw new TypeError("Release technology differs from archived source reference");
	return appendVndbSemanticPlan(
		tx,
		reference,
		actor,
		expectedRevision,
		{
			facts: [],
			relations: [
				{
					key: value.kind === "drm" ? "uses-access-mechanism" : "uses-software-engine",
					path: value.path,
					spoiler: 0,
					qualifiers: [],
					participants: [
						{
							role: value.kind === "drm" ? "mechanism" : "engine",
							target: {
								owner: value.kind === "drm" ? "reference" : "software",
								shape: value.kind === "drm" ? "access-mechanism" : "engine",
								objectType: value.kind,
								externalId: String(value.id),
								path: value.path,
							},
						},
					],
				},
			],
		},
		document,
	);
}

/** @alpha First adoption of native taxonomy concepts, quoted passages, DRM mechanisms and engines. */
export async function adoptVndbSemanticObject(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new TypeError("VNDB semantic object bytes differ from archived observation");
	if (
		receipt.key.source !== "vndb" ||
		![VndbCatalogContractSha256, VndbDumpContractSha256].includes(receipt.contractSha256)
	)
		throw new TypeError("VNDB semantic source contract is not reviewed");
	const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
	if (!input || typeof input !== "object" || Array.isArray(input))
		throw new TypeError("VNDB semantic object must be an object");
	const family = z.enum(["tag", "trait", "quote", "drm", "engine"]).parse(receipt.key.objectType);
	const normalized =
		receipt.contractSha256 === VndbDumpContractSha256
			? normalizeVndbSemanticDump(family, input)
			: null;
	const record =
		normalized?.record ?? VndbSemanticObjectSchema.parse({ ...input, objectType: family });
	if (String(record.id) !== receipt.key.externalId)
		throw new TypeError("VNDB semantic object identity differs from source record");
	const document = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		document,
		`vndb.${record.objectType}.semantic.1`,
	);
	if (existing && existing.status !== "initialize_reference") return existing;
	const owner = record.objectType === "engine" ? "software" : "reference";
	const shape =
		record.objectType === "engine"
			? "engine"
			: record.objectType === "drm"
				? "access-mechanism"
				: record.objectType === "quote"
					? "quotation"
					: "concept";
	const identity = existing
		? { ...existing.reference, revision: existing.revision }
		: await createCatalogIdentity(tx, { owner, shape }, actor);
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		reference: identity,
		mappingVersion: `vndb.${record.objectType}.semantic.1`,
	});
	let revision = await initializeVndbNativeNames(
		tx,
		identity,
		actor,
		identity.revision,
		planVndbSupportingNames(record).map((item) => ({
			...item,
			path: normalized ? normalized.sourcePath(item.path) : item.path,
		})),
		document,
	);
	const plan = planVndbSupportingSemantics(record);
	if (normalized) {
		for (const fact of plan.facts) fact.path = normalized.sourcePath(fact.path);
		for (const relation of plan.relations) {
			relation.path = normalized.sourcePath(relation.path);
			for (const qualifier of relation.qualifiers)
				qualifier.path = normalized.sourcePath(qualifier.path);
			for (const participant of relation.participants)
				participant.target.path = normalized.sourcePath(participant.target.path);
		}
	}
	revision = await appendVndbSemanticPlan(tx, identity, actor, revision, plan, document);
	const tables = CatalogFactTables[owner];
	if (!existing) {
		const [identifier] = await tx
			.insert(tables.identifier)
			.values({
				ownerId: identity.id,
				namespace: `vndb.${record.objectType}`,
				value: String(record.id),
				normalizedValue: String(record.id),
			})
			.returning({ id: tables.identifier.id, identifierRevision: tables.identifier.revision });
		if (!identifier) throw new Error("VNDB semantic identifier insertion returned no row");
		await tx.insert(tables.support).values({
			...(await catalogSourceSupportColumns(tx, document.record.id)),
			ownerId: identity.id,
			identifierId: identifier.id,
			identifierRevision: identifier.identifierRevision,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: "/id",
		});
	}
	const reference: CatalogReference = { owner, id: identity.id };
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: document.record.id,
			mappingVersion: `vndb.${record.objectType}.semantic.1`,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await sealCatalogSourceChildCorrespondence(tx, actor, {
			sourceRecordId: document.record.id,
			mappingVersion: `vndb.${record.objectType}.semantic.1`,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
		});
	return {
		status: "created" as const,
		reference,
		revision,
		snapshotId: document.snapshot.id,
	};
}

/** @internal Normalized dump plans retain the original archived pointer at every evidence edge. */
export function remapVndbSemanticPlan(
	plan: VndbSemanticPlan,
	path: (value: string) => string,
): VndbSemanticPlan {
	return {
		facts: plan.facts.map((value) => ({ ...value, path: path(value.path) })),
		relations: plan.relations.map((value) => ({
			...value,
			path: path(value.path),
			qualifiers: value.qualifiers.map((fact) => ({
				...fact,
				path: path(fact.path),
			})),
			participants: value.participants.map((participant) => ({
				...participant,
				target: { ...participant.target, path: path(participant.target.path) },
			})),
		})),
	};
}

/** @internal Stable semantic occurrence keys exclude mutable qualifiers and source array positions. */
export function vndbSemanticKeys(plan: VndbSemanticPlan) {
	const duplicates = new Map<string, number>();
	const identify = (parts: unknown[]) => {
		const value = JSON.stringify(parts);
		const index = duplicates.get(value) ?? 0;
		duplicates.set(value, index + 1);
		return `${createHash("sha256").update(value).digest("hex")}/${index}`;
	};
	const facts = plan.facts.map((fact) => identify(["fact", fact.namespace, fact.key]));
	const relations = plan.relations.map((relation) =>
		identify([
			"relation",
			relation.key,
			relation.participants.map(({ role, target }) => [role, target.objectType, target.externalId]),
			relation.qualifiers
				.filter(
					(fact) =>
						["external-site", "external-identifier", "image-source-language"].includes(fact.key) ||
						(fact.key === "url" &&
							!relation.qualifiers.some((other) => other.key === "external-identifier")),
				)
				.map((fact) => [fact.namespace, fact.key, fact.value]),
		]),
	);
	const qualifiers = plan.relations.map((relation, index) =>
		relation.qualifiers.map((fact) =>
			identify(["qualifier", relations[index], fact.namespace, fact.key]),
		),
	);
	return { facts, relations, qualifiers };
}

/** @internal Exact per-snapshot source support identity avoids ambiguous repeated qualifiers. */
export function vndbSemanticSupportId(
	document: { record: Pick<Document["record"], "id">; snapshot: Pick<Document["snapshot"], "id"> },
	key: string,
	scope: CatalogSourceChildCorrespondence,
) {
	const bytes = createHash("sha256")
		.update(
			`vndb-semantic-support\n${document.record.id}\n${document.snapshot.id}\n${scope.mappingKey}\n${scope.correspondenceRevision}\n${key}`,
		)
		.digest();
	bytes[6] = ((bytes[6] ?? 0) & 15) | 128;
	bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
	const hex = bytes.subarray(0, 16).toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function reuseVndbSemanticSupport(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	document: Document,
	key: string,
	sourcePath: string,
	value: { id: string; kind: "fact" | "relation" },
	scope: CatalogSourceChildCorrespondence,
) {
	const table = CatalogFactTables[reference.owner].support;
	const id = vndbSemanticSupportId(document, key, scope);
	await tx
		.insert(table)
		.values({
			id,
			ownerId: reference.id,
			factId: value.kind === "fact" ? value.id : null,
			relationId: value.kind === "relation" ? value.id : null,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath,
		})
		.onConflictDoNothing();
	const [row] = await tx
		.select()
		.from(table)
		.where(and(eq(table.ownerId, reference.id), eq(table.id, id)))
		.limit(1);
	if (
		!row ||
		row.sourceRecordId !== document.record.id ||
		row.snapshotId !== document.snapshot.id ||
		row.sourcePath !== sourcePath ||
		(value.kind === "fact" ? row.factId : row.relationId) !== value.id
	)
		throw new Error("Immutable VNDB semantic source occurrence differs");
}
