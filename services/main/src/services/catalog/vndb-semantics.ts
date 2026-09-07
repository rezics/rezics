import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { acceptCatalogSourceInitialization, bindCatalogSourceIdentity } from "./source-bindings";
import type { CatalogOwner, CatalogReference } from "./contracts";
import { bindReferencedSourceIdentity } from "./source-references";
import { inspectExistingSourceBinding } from "./source-adoption";
import { recordCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import {
	addCatalogName,
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
	{ owner: "entity", shapes: ["person", "organization", "character", "unresolved"] },
	{ owner: "reference", shapes: ["concept", "quotation", "image", "access-mechanism"] },
];
const roleTargets: Record<string, TargetRule[]> = {
	subject: subjectTargets,
	image: [{ owner: "reference", shapes: ["image"] }],
	content: [{ owner: "software", shapes: ["content"] }],
	release: [{ owner: "software", shapes: ["release"] }],
	concept: [{ owner: "reference", shapes: ["concept"] }],
	character: [{ owner: "entity", shapes: ["character"] }],
	mechanism: [{ owner: "reference", shapes: ["access-mechanism"] }],
	engine: [{ owner: "software", shapes: ["engine"] }],
	related: [
		{ owner: "software", shapes: ["content"] },
		{ owner: "entity", shapes: ["person", "organization", "unresolved"] },
	],
};
const scalarDefinitions: VndbSemanticFact[] = [
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
	].map((key) => ({
		namespace: "catalog.metadata" as const,
		key,
		kind: "string" as const,
		value: null,
		path: "/",
	})),
	...[
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
 * @remarks The vocabulary has fewer than 64 scalar definitions. A request-local map avoids
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
) {
	const fact = await beginCatalogFact(tx, reference, actor, revision, definitionId);
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
		ownerId: reference.id,
		factId: fact.id,
		sourceRecordId: document.record.id,
		snapshotId: document.snapshot.id,
		sourcePath: item.path,
	});
	return { id: fact.id, revision: sealed.revision };
}

function allowedRoles(relation: VndbSemanticRelation) {
	if (relation.key === "external-link") return ["subject"];
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

async function appendPlan(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	revision: number,
	plan: VndbSemanticPlan,
	document: Document,
) {
	if (!plan.facts.length && !plan.relations.length) return revision;
	await loadCatalogIdentity(tx, reference, actor, true);
	const { definitions, roles } = await semanticDefinitions(tx);
	for (const item of plan.facts)
		revision = (
			await appendFact(
				tx,
				reference,
				actor,
				revision,
				item,
				mustGet(definitions, `${item.namespace}:${item.key}`),
				document,
			)
		).revision;
	const targets = new Map<string, CatalogReference>();
	const predicates = new Map<string, string>();
	for (const relation of plan.relations) {
		if (relation.qualifiers.length > 64)
			throw new RangeError(
				"VNDB relation qualifier budget exceeded; split language scopes into bounded commands",
			);
		const qualifiers: { definitionRevisionId: string; valueFactId: string }[] = [];
		for (const item of relation.qualifiers) {
			const definitionId = mustGet(definitions, `${item.namespace}:${item.key}`);
			const created = await appendFact(
				tx,
				reference,
				actor,
				revision,
				item,
				definitionId,
				document,
			);
			revision = created.revision;
			qualifiers.push({ definitionRevisionId: definitionId, valueFactId: created.id });
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
			participants.push({ roleRevisionId: mustGet(roles, participant.role), target: native });
		}
		let definitionRevisionId = predicates.get(relation.key);
		if (!definitionRevisionId) {
			const relationRoles = allowedRoles(relation).map((role, index) => ({
				roleRevisionId: mustGet(roles, role),
				min: index < 2 ? 1 : 0,
				max: 1,
				targets: roleTargets[role] ?? [],
			}));
			const constraints = { roles: relationRoles, qualifierRevisionIds: [...definitions.values()] };
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
		const created = await createCatalogRelation(tx, reference, actor, revision, {
			definitionRevisionId,
			participants,
			...{ qualifiers, spoiler: relation.spoiler },
		});
		revision = created.revision;
		await tx.insert(CatalogFactTables[reference.owner].support).values({
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
): Promise<number> {
	return appendPlan(tx, reference, actor, expectedRevision, planVndbSemantics(record), document);
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
	return appendPlan(
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
	return appendPlan(
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
	let revision = identity.revision;
	if ("name" in record)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-primary",
				languageTag: null,
				value: record.name,
			})
		).revision;
	if ("aliases" in record)
		for (const alias of record.aliases ?? [])
			if (alias)
				revision = (
					await addCatalogName(tx, identity, actor, revision, {
						kind: "source-alias",
						languageTag: null,
						value: alias,
					})
				).revision;
	const plan: VndbSemanticPlan =
		typeof record.id === "string" ? planVndbSemantics(record) : { facts: [], relations: [] };
	const add = (
		key: string,
		value: string | number | boolean | null,
		path: string,
		kind: VndbSemanticFact["kind"],
		namespace: VndbSemanticFact["namespace"] = "source.vndb.qualifier",
	) => plan.facts.push({ key, value, path, kind, namespace });
	if (record.objectType === "tag" || record.objectType === "trait") {
		for (const field of ["searchable", "applicable"] as const)
			if (record[field] !== undefined)
				add(`taxonomy-${field}`, record[field], `/${field}`, "boolean");
		if (record.defaultspoil !== undefined)
			add("taxonomy-default-spoiler", record.defaultspoil, "/defaultspoil", "number");
		if (record.objectType === "tag" && record.category !== undefined)
			add("taxonomy-category", record.category, "/category", "string");
		if (record.objectType === "trait") {
			if (record.sexual !== undefined) add("taxonomy-sexual", record.sexual, "/sexual", "boolean");
			if (record.gorder !== undefined)
				add("taxonomy-group-order", record.gorder, "/gorder", "number");
			if (record.group_id && record.group_id !== record.id)
				plan.relations.push({
					key: "has-trait-group",
					path: "/group_id",
					spoiler: 0,
					qualifiers: [],
					participants: [
						{
							role: "concept",
							target: {
								owner: "reference",
								shape: "concept",
								objectType: "trait",
								externalId: record.group_id,
								path: "/group_id",
								name: record.group_name,
							},
						},
					],
				});
		}
	}
	if (record.objectType === "quote") {
		add("quotation-text", record.quote, "/quote", "string", "catalog.metadata");
		const participants: VndbSemanticRelation["participants"] = [
			{
				role: "content",
				target: {
					owner: "software",
					shape: "content",
					objectType: "vn",
					externalId: record.vn.id,
					path: "/vn/id",
				},
			},
		];
		if (record.character)
			participants.push({
				role: "character",
				target: {
					owner: "entity",
					shape: "character",
					objectType: "character",
					externalId: record.character.id,
					path: "/character/id",
				},
			});
		plan.relations.push({
			key: "quotation-context",
			path: "/vn",
			spoiler: 0,
			qualifiers: [],
			participants,
		});
	}
	if (record.objectType === "drm") {
		const properties = {
			disc: "requires-disc-check",
			cdkey: "requires-product-key",
			activate: "requires-online-activation",
			alimit: "limits-activations",
			account: "requires-account",
			online: "requires-continuous-network",
			cloud: "cloud-streamed",
			physical: "requires-physical-token",
		} as const;
		for (const field of Object.keys(properties) as (keyof typeof properties)[])
			add(properties[field], record[field], `/${field}`, "boolean", "catalog.metadata");
	}
	if (
		(record.objectType === "drm" || record.objectType === "engine") &&
		record.description !== undefined
	)
		add(
			record.objectType === "drm" ? "access-mechanism-description" : "engine-description",
			record.description,
			"/description",
			"string",
			"catalog.metadata",
		);
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
	revision = await appendPlan(tx, identity, actor, revision, plan, document);
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
			.returning({ id: tables.identifier.id });
		if (!identifier) throw new Error("VNDB semantic identifier insertion returned no row");
		await tx.insert(tables.support).values({
			ownerId: identity.id,
			identifierId: identifier.id,
			sourceRecordId: document.record.id,
			snapshotId: document.snapshot.id,
			sourcePath: "/id",
		});
	}
	const reference: CatalogReference = { owner, id: identity.id };
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: document.record.id,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await bindCatalogSourceIdentity(tx, actor, {
			sourceRecordId: document.record.id,
			path: "/",
			snapshotId: document.snapshot.id,
			reference,
		});
	return {
		status: "created" as const,
		reference: { owner, id: identity.id },
		revision,
		snapshotId: document.snapshot.id,
	};
}
