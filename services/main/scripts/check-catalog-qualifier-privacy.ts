import assert from "node:assert/strict";
import Elysia from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { catalogValueNodes } from "../src/services/catalog/value-nodes";
import type { CatalogReference } from "@rezics/reference";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogCreatedSchema } from "../src/services/catalog/resource-contracts";
import { z } from "zod";

const QUALIFIER_LIMITS = {
	maxQualifiers: 64,
	maxInlineNodes: 512,
	maxParticipants: 128,
	commandBytes: 512_000,
} as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable API fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("Requires isolated loopback Atlas target");
const observability = initializeObservability({
	service: {
		name: "rezics-catalog-qualifier-privacy-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { resolveIdentity } = await import("../src/services/auth/session");
const { ensureCatalogDefinition } = await import("../src/services/catalog/storage");
const { runWithParticipationAuthority, requireParticipation } = await import(
	"../src/services/participation/policy"
);
const { CatalogResourceSchema } = await import("../src/services/catalog/resource-contracts");
const {
	WriteCatalogFactSchema,
	WriteCatalogRelationSchema,
	CatalogSemanticCreatedSchema,
	CatalogSemanticMutationSchema,
	CatalogFactSummarySchema,
	CatalogRelationSummarySchema,
	catalogSemanticPage,
	CatalogValuePageSchema,
	CatalogQualifierSchema,
	CatalogSemanticHistorySchema,
	CatalogSemanticStateSchema,
	CatalogSemanticRestoreSchema,
} = await import("../src/services/catalog/semantic-api-contracts");
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog);
api.compile();
const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
const coverage: string[] = [];

function covered(name: string) {
	coverage.push(name);
}

async function actor() {
	const account = await database.transaction(async (tx) => {
		const [row] = await tx
			.insert(users)
			.values({
				name: "Qualifier privacy API fixture",
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(row);
		await ensureSelfEntityInTransaction(tx, row);
		return row;
	});
	accounts.push(account.id);
	const session = await context.internalAdapter.createSession(account.id);
	const [cookie] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			session.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return cookie;
}
async function request(
	method: string,
	path: string,
	body: unknown,
	expected: number,
	cookie?: string,
) {
	const headers = new Headers({ Accept: "application/json" });
	if (cookie) headers.set("Cookie", cookie);
	if (body !== undefined) headers.set("Content-Type", "application/json");
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 2500)}`);
	assertions++;
	const value: unknown = text ? JSON.parse(text) : null;
	assert.equal(text.includes('"createdByAuthUserId"'), false);
	assertions++;
	return value;
}
async function create(body: unknown, cookie: string) {
	return CatalogCreatedSchema.parse(await request("POST", "/catalog/resources", body, 200, cookie));
}
const name = (value: string) => ({ languageTag: "en", value });
type CreatedSemantic = z.output<typeof CatalogSemanticCreatedSchema>;
type SemanticHead = z.output<typeof CatalogSemanticMutationSchema>;
const factsPage = catalogSemanticPage(CatalogFactSummarySchema);
const relationsPage = catalogSemanticPage(CatalogRelationSummarySchema);
const qualifiersPage = catalogSemanticPage(CatalogQualifierSchema);
const pathFor = (reference: CatalogReference) =>
	`/catalog/resources/${reference.owner}/${reference.id}`;
const nodesFor = (value: unknown) => [...catalogValueNodes(value)];
async function current(reference: CatalogReference, cookie: string) {
	return CatalogResourceSchema.parse(
		await request("GET", pathFor(reference), undefined, 200, cookie),
	);
}
async function publishWithVisibility(
	reference: CatalogReference,
	cookie: string,
	visibility: "public" | "private",
) {
	const metadata = await current(reference, cookie);
	await request(
		"PATCH",
		pathFor(reference) + "/lifecycle",
		{
			expectedRevision: metadata.revision,
			status: "published",
			visibility,
			contentRating: metadata.contentRating,
		},
		200,
		cookie,
	);
}
async function snapshot(reference: CatalogReference, cookie: string) {
	const tables = CatalogFactTables[reference.owner];
	const metadata = await current(reference, cookie);
	const count = async (
		table:
			| typeof tables.fact
			| typeof tables.valueNode
			| typeof tables.relation
			| typeof tables.participant
			| typeof tables.relationScope
			| typeof tables.semanticHead
			| typeof tables.semanticRevision
			| typeof tables.change,
	) => {
		const [row] = await database
			.select({ count: sql<number>`count(*)::integer` })
			.from(table)
			.where(eq(table.ownerId, reference.id));
		assert.ok(row);
		return row.count;
	};
	return {
		revision: metadata.revision,
		facts: await count(tables.fact),
		nodes: await count(tables.valueNode),
		relations: await count(tables.relation),
		participants: await count(tables.participant),
		qualifiers: await count(tables.relationScope),
		heads: await count(tables.semanticHead),
		history: await count(tables.semanticRevision),
		changes: await count(tables.change),
	};
}
async function rejectedWithoutMutation(
	reference: CatalogReference,
	cookie: string,
	work: () => Promise<unknown>,
) {
	const before = await snapshot(reference, cookie);
	await work();
	assert.deepEqual(await snapshot(reference, cookie), before);
	assertions++;
}
async function writeFact(
	reference: CatalogReference,
	cookie: string,
	definitionRevisionId: string,
	value: unknown,
	replaces?: CreatedSemantic | SemanticHead,
) {
	const metadata = await current(reference, cookie);
	const body = WriteCatalogFactSchema.parse({
		expectedRevision: metadata.revision,
		definitionRevisionId,
		nodes: nodesFor(value),
		...(replaces
			? { replaces: { semanticId: replaces.semanticId, headVersion: replaces.headVersion } }
			: {}),
	});
	return CatalogSemanticCreatedSchema.parse(
		await request("POST", pathFor(reference) + "/facts", body, 200, cookie),
	);
}
async function writeRelation(
	reference: CatalogReference,
	cookie: string,
	body: Omit<z.input<typeof WriteCatalogRelationSchema>, "expectedRevision"> & {
		replaces?: { semanticId: string; headVersion: number };
	},
) {
	const now = await current(reference, cookie);
	const parsed = WriteCatalogRelationSchema.parse({
		...body,
		expectedRevision: now.revision,
	});
	return CatalogSemanticCreatedSchema.parse(
		await request("POST", pathFor(reference) + "/relations", parsed, 200, cookie),
	);
}
async function factRecord(reference: CatalogReference, factId: string) {
	const table = CatalogFactTables[reference.owner].fact;
	const [row] = await database
		.select({
			id: table.id,
			purpose: table.purpose,
			semanticId: table.semanticId,
			state: table.state,
		})
		.from(table)
		.where(and(eq(table.ownerId, reference.id), eq(table.id, factId)))
		.limit(1);
	assert.ok(row);
	assertions++;
	return row;
}
async function listedFactIds(reference: CatalogReference, cookie: string | undefined, extra = "") {
	const page = factsPage.parse(
		await request("GET", `${pathFor(reference)}/facts${extra}`, undefined, 200, cookie),
	);
	return page.items.map((row) => row.id);
}
async function listedRelationIds(reference: CatalogReference, cookie: string | undefined) {
	const page = relationsPage.parse(
		await request("GET", `${pathFor(reference)}/relations`, undefined, 200, cookie),
	);
	return page.items.map((row) => row.id);
}

try {
	const schemaLimits = WriteCatalogRelationSchema.safeParse({
		expectedRevision: 1,
		definitionRevisionId: "019b1234-0000-7000-8000-000000000001",
		participants: [
			{
				roleRevisionId: "019b1234-0000-7000-8000-000000000002",
				target: { owner: "entity", id: "019b1234-0000-7000-8000-000000000003" },
			},
		],
		qualifiers: Array.from({ length: QUALIFIER_LIMITS.maxQualifiers + 1 }, () => ({
			definitionRevisionId: "019b1234-0000-7000-8000-000000000004",
			valueFactId: "019b1234-0000-7000-8000-000000000005",
		})),
	});
	assert.equal(schemaLimits.success, false);
	assertions++;
	covered("schema-rejects-65-qualifiers");
	const tooManyNodes = WriteCatalogRelationSchema.safeParse({
		expectedRevision: 1,
		definitionRevisionId: "019b1234-0000-7000-8000-000000000001",
		participants: [
			{
				roleRevisionId: "019b1234-0000-7000-8000-000000000002",
				target: { owner: "entity", id: "019b1234-0000-7000-8000-000000000003" },
			},
		],
		qualifiers: [
			{
				definitionRevisionId: "019b1234-0000-7000-8000-000000000004",
				nodes: Array.from({ length: QUALIFIER_LIMITS.maxInlineNodes + 1 }, (_, position) => ({
					position,
					parentPosition: position === 0 ? null : 0,
					parentKind: position === 0 ? null : "array",
					memberKey: null,
					kind: position === 0 ? "array" : "string",
					textValue: position === 0 ? null : "x",
					numberValue: null,
					booleanValue: null,
				})),
			},
		],
	});
	assert.equal(tooManyNodes.success, false);
	assertions++;
	covered("schema-rejects-513-inline-nodes");
	const reusedOrInline = WriteCatalogRelationSchema.safeParse({
		expectedRevision: 1,
		definitionRevisionId: "019b1234-0000-7000-8000-000000000001",
		participants: [
			{
				roleRevisionId: "019b1234-0000-7000-8000-000000000002",
				target: { owner: "entity", id: "019b1234-0000-7000-8000-000000000003" },
			},
		],
		qualifiers: [
			{
				definitionRevisionId: "019b1234-0000-7000-8000-000000000004",
				valueFactId: "019b1234-0000-7000-8000-000000000005",
			},
			{
				definitionRevisionId: "019b1234-0000-7000-8000-000000000006",
				nodes: nodesFor("inline"),
			},
		],
	});
	assert.equal(reusedOrInline.success, true);
	assertions++;
	covered("schema-accepts-reused-assertion-or-inline-nodes");

	const owner = await actor(),
		stranger = await actor();
	const publicOwner = await create(
		{ kind: "entity", shape: "person", name: name("Public owner") },
		owner,
	);
	const publicActor = await create(
		{ kind: "entity", shape: "person", name: name("Public actor") },
		owner,
	);
	const privateContext = await create(
		{ kind: "entity", shape: "person", name: name("Private context") },
		owner,
	);
	await publishWithVisibility(publicOwner.reference, owner, "public");
	await publishWithVisibility(publicActor.reference, owner, "public");
	await publishWithVisibility(privateContext.reference, owner, "private");
	const identity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: owner } }),
		"account:read",
	);
	if (!("participation" in identity))
		throw new Error("Fixture definitions require explicit participation");
	const namespace = "fixture.qualifier-privacy." + crypto.randomUUID();
	const meanings = await runWithParticipationAuthority(identity.participation, () =>
		database.transaction(async (tx) => {
			await requireParticipation(tx, identity.participation, "entity.security", {
				owner: "entity",
				id: identity.participation.actingEntityId,
			});
			const credit = await ensureCatalogDefinition(tx, {
				namespace,
				key: "credit_qualifier",
				kind: "property",
				valueKind: "string",
				constraints: { minLength: 1, maxLength: 32 },
			});
			const note = await ensureCatalogDefinition(tx, {
				namespace,
				key: "note_qualifier",
				kind: "property",
				valueKind: "string",
				constraints: { minLength: 1, maxLength: 32 },
			});
			const subjectRole = await ensureCatalogDefinition(tx, {
				namespace,
				key: "subject",
				kind: "role",
				valueKind: null,
			});
			const actorRole = await ensureCatalogDefinition(tx, {
				namespace,
				key: "contributor",
				kind: "role",
				valueKind: null,
			});
			const predicate = await ensureCatalogDefinition(tx, {
				namespace,
				key: "qualified_contribution",
				kind: "predicate",
				valueKind: null,
				constraints: {
					roles: [
						{
							roleRevisionId: subjectRole.revisionId,
							min: 1,
							max: 1,
							targets: [{ owner: "entity", shapes: ["person"] }],
						},
						{
							roleRevisionId: actorRole.revisionId,
							min: 1,
							max: 1,
							targets: [{ owner: "entity", shapes: ["person"] }],
						},
					],
					qualifierRevisionIds: [credit.revisionId, note.revisionId],
				},
			});
			return { credit, note, subjectRole, actorRole, predicate };
		}),
	);
	const reference = publicOwner.reference,
		path = pathFor(reference);
	const participants = (actorTarget: CatalogReference) => [
		{ roleRevisionId: meanings.subjectRole.revisionId, target: reference },
		{ roleRevisionId: meanings.actorRole.revisionId, target: actorTarget },
	];
	const relationBody = (
		actorTarget: CatalogReference,
		qualifiers: z.input<typeof WriteCatalogRelationSchema>["qualifiers"],
	) => ({
		definitionRevisionId: meanings.predicate.revisionId,
		participants: participants(actorTarget),
		qualifiers,
	});

	const assertion = await writeFact(reference, owner, meanings.credit.revisionId, "reused");
	const assertionRow = await factRecord(reference, assertion.id);
	assert.equal(assertionRow.purpose, "assertion");
	assertions++;
	covered("standalone-write-is-assertion");

	const publicRelation = await writeRelation(
		reference,
		owner,
		relationBody(publicActor.reference, [
			{ definitionRevisionId: meanings.credit.revisionId, nodes: nodesFor("inline-public") },
		]),
	);
	const publicQualifiers = qualifiersPage.parse(
		await request(
			"GET",
			`${path}/relations/${publicRelation.id}/qualifiers`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(publicQualifiers.items.length, 1);
	assert.equal(publicQualifiers.items[0]?.valueFactPurpose, "qualifier");
	assertions += 2;
	covered("dto-qualifiers-expose-valueFactPurpose");
	const inlineFactId = publicQualifiers.items[0]!.valueFactId;
	const inlineRow = await factRecord(reference, inlineFactId);
	assert.equal(inlineRow.purpose, "qualifier");
	assert.notEqual(inlineFactId, assertion.id);
	assertions += 2;
	covered("inline-nodes-create-qualifier-purpose");

	const reusedRelation = await writeRelation(
		reference,
		owner,
		relationBody(publicActor.reference, [
			{ definitionRevisionId: meanings.credit.revisionId, valueFactId: assertion.id },
		]),
	);
	const reusedQualifiers = qualifiersPage.parse(
		await request(
			"GET",
			`${path}/relations/${reusedRelation.id}/qualifiers`,
			undefined,
			200,
			owner,
		),
	);
	assert.deepEqual(
		reusedQualifiers.items.map((row) => [row.valueFactId, row.valueFactPurpose]),
		[[assertion.id, "assertion"]],
	);
	assertions++;
	assert.equal((await factRecord(reference, assertion.id)).purpose, "assertion");
	assertions++;
	covered("reused-ordinary-assertion-keeps-purpose");

	const ownerFacts = await listedFactIds(reference, owner);
	assert.equal(ownerFacts.includes(assertion.id), true);
	assert.equal(ownerFacts.includes(inlineFactId), false);
	assertions += 2;
	const ownerInactive = await listedFactIds(reference, owner, "?includeInactive=true");
	assert.equal(ownerInactive.includes(inlineFactId), false);
	assertions++;
	covered("ordinary-fact-lists-hide-qualifier-only-even-owner");
	await request("GET", `${path}/semantics/${inlineRow.semanticId}/history`, undefined, 404, owner);
	covered("ordinary-history-hides-qualifier-only-even-owner");
	const assertionHistory = CatalogSemanticHistorySchema.parse(
		await request(
			"GET",
			`${path}/semantics/${assertion.semanticId}/history`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(assertionHistory.items.length >= 1, true);
	assertions++;

	await request("GET", `${path}/facts/${inlineFactId}/nodes`, undefined, 404, owner);
	covered("owner-cannot-read-qualifier-nodes-without-relationId");
	const authorizedNodes = CatalogValuePageSchema.parse(
		await request(
			"GET",
			`${path}/facts/${inlineFactId}/nodes?relationId=${publicRelation.id}`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(authorizedNodes.items[0]?.textValue, "inline-public");
	assertions++;
	covered("exact-owning-relationId-authorizes-allowed-reader");
	await request(
		"GET",
		`${path}/facts/${inlineFactId}/nodes?relationId=${reusedRelation.id}`,
		undefined,
		404,
		owner,
	);
	covered("unrelated-relationId-cannot-read-private-value");

	for (const reader of [undefined, stranger] as const) {
		await request("GET", `${path}/facts/${inlineFactId}/nodes`, undefined, 404, reader);
		await request(
			"GET",
			`${path}/semantics/${inlineRow.semanticId}/history`,
			undefined,
			404,
			reader,
		);
		const visibleFacts = await listedFactIds(reference, reader);
		assert.equal(visibleFacts.includes(inlineFactId), false);
		assert.equal(visibleFacts.includes(assertion.id), true);
		assertions += 2;
		const publicNodes = CatalogValuePageSchema.parse(
			await request(
				"GET",
				`${path}/facts/${inlineFactId}/nodes?relationId=${publicRelation.id}`,
				undefined,
				200,
				reader,
			),
		);
		assert.equal(publicNodes.items[0]?.textValue, "inline-public");
		assertions++;
	}
	covered("anonymous-and-foreign-cannot-read-standalone-qualifier-listings-history-nodes");
	covered("public-current-relation-authorizes-public-qualifier-nodes");

	const privateRelation = await writeRelation(
		reference,
		owner,
		relationBody(privateContext.reference, [
			{ definitionRevisionId: meanings.note.revisionId, nodes: nodesFor("context-secret") },
		]),
	);
	const privateQualifiers = qualifiersPage.parse(
		await request(
			"GET",
			`${path}/relations/${privateRelation.id}/qualifiers`,
			undefined,
			200,
			owner,
		),
	);
	const privateFactId = privateQualifiers.items[0]!.valueFactId;
	assert.equal(privateQualifiers.items[0]?.valueFactPurpose, "qualifier");
	assertions++;
	const ownerRelations = await listedRelationIds(reference, owner);
	assert.equal(ownerRelations.includes(privateRelation.id), true);
	assertions++;
	for (const reader of [undefined, stranger] as const) {
		const visibleRelations = await listedRelationIds(reference, reader);
		assert.equal(visibleRelations.includes(privateRelation.id), false);
		assertions++;
		await request(
			"GET",
			`${path}/relations/${privateRelation.id}/qualifiers`,
			undefined,
			404,
			reader,
		);
		await request(
			"GET",
			`${path}/facts/${privateFactId}/nodes?relationId=${privateRelation.id}`,
			undefined,
			404,
			reader,
		);
	}
	covered("private-context-blocks-relation-and-qualifier-values");
	CatalogValuePageSchema.parse(
		await request(
			"GET",
			`${path}/facts/${privateFactId}/nodes?relationId=${privateRelation.id}`,
			undefined,
			200,
			owner,
		),
	);

	await publishWithVisibility(privateContext.reference, owner, "public");
	for (const reader of [undefined, stranger] as const) {
		const visibleRelations = await listedRelationIds(reference, reader);
		assert.equal(visibleRelations.includes(privateRelation.id), true);
		assertions++;
		const publishedQualifiers = qualifiersPage.parse(
			await request(
				"GET",
				`${path}/relations/${privateRelation.id}/qualifiers`,
				undefined,
				200,
				reader,
			),
		);
		assert.equal(publishedQualifiers.items[0]?.valueFactId, privateFactId);
		assertions++;
		CatalogValuePageSchema.parse(
			await request(
				"GET",
				`${path}/facts/${privateFactId}/nodes?relationId=${privateRelation.id}`,
				undefined,
				200,
				reader,
			),
		);
	}
	covered("publish-context-through-owning-lifecycle-makes-relation-public");
	await publishWithVisibility(privateContext.reference, owner, "private");
	for (const reader of [undefined, stranger] as const) {
		const visibleRelations = await listedRelationIds(reference, reader);
		assert.equal(visibleRelations.includes(privateRelation.id), false);
		assertions++;
		await request(
			"GET",
			`${path}/relations/${privateRelation.id}/qualifiers`,
			undefined,
			404,
			reader,
		);
		await request(
			"GET",
			`${path}/facts/${privateFactId}/nodes?relationId=${privateRelation.id}`,
			undefined,
			404,
			reader,
		);
	}
	covered("unpublish-context-through-owning-lifecycle-restores-privacy");

	const replacedPublic = await writeRelation(
		reference,
		owner,
		{
			...relationBody(publicActor.reference, [
				{ definitionRevisionId: meanings.credit.revisionId, nodes: nodesFor("inline-replaced") },
			]),
			replaces: { semanticId: publicRelation.semanticId, headVersion: publicRelation.headVersion },
		},
	);
	const historicalQualifiers = qualifiersPage.parse(
		await request(
			"GET",
			`${path}/relations/${publicRelation.id}/qualifiers`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(historicalQualifiers.items[0]?.valueFactId, inlineFactId);
	assertions++;
	covered("editors-may-read-historical-relation-qualifiers");
	const currentPublicQualifiers = qualifiersPage.parse(
		await request(
			"GET",
			`${path}/relations/${replacedPublic.id}/qualifiers`,
			undefined,
			200,
			owner,
		),
	);
	const currentInlineFactId = currentPublicQualifiers.items[0]!.valueFactId;
	assert.equal(currentPublicQualifiers.items[0]?.valueFactPurpose, "qualifier");
	assert.notEqual(currentInlineFactId, inlineFactId);
	assertions += 2;
	for (const reader of [undefined, stranger] as const) {
		await request(
			"GET",
			`${path}/relations/${publicRelation.id}/qualifiers`,
			undefined,
			404,
			reader,
		);
		await request(
			"GET",
			`${path}/facts/${inlineFactId}/nodes?relationId=${publicRelation.id}`,
			undefined,
			404,
			reader,
		);
		CatalogValuePageSchema.parse(
			await request(
				"GET",
				`${path}/facts/${currentInlineFactId}/nodes?relationId=${replacedPublic.id}`,
				undefined,
				200,
				reader,
			),
		);
	}
	covered("public-readers-require-current-relation");

	await rejectedWithoutMutation(reference, owner, async () => {
		const now = await current(reference, owner);
		await request(
			"POST",
			path + "/facts",
			{
				expectedRevision: now.revision,
				definitionRevisionId: meanings.credit.revisionId,
				replaces: { semanticId: inlineRow.semanticId, headVersion: 1 },
				nodes: nodesFor("purpose-change"),
			},
			422,
			owner,
		);
	});
	assert.equal((await factRecord(reference, inlineFactId)).purpose, "qualifier");
	assertions++;
	covered("replacement-cannot-change-fact-purpose");

	const disputed = CatalogSemanticMutationSchema.parse(
		await request(
			"POST",
			`${path}/semantics/${inlineRow.semanticId}/state`,
			CatalogSemanticStateSchema.parse({
				expectedRevision: (await current(reference, owner)).revision,
				expectedHeadVersion: 1,
				state: "disputed",
			}),
			200,
			owner,
		),
	);
	const restored = CatalogSemanticMutationSchema.parse(
		await request(
			"POST",
			`${path}/semantics/${inlineRow.semanticId}/restore`,
			CatalogSemanticRestoreSchema.parse({
				expectedRevision: (await current(reference, owner)).revision,
				expectedHeadVersion: disputed.headVersion,
				restoreVersion: 1,
			}),
			200,
			owner,
		),
	);
	assert.equal((await factRecord(reference, inlineFactId)).purpose, "qualifier");
	assert.equal(restored.semanticId, inlineRow.semanticId);
	assertions += 2;
	covered("restore-preserves-qualifier-purpose");
	await rejectedWithoutMutation(reference, owner, async () => {
		const now = await current(reference, owner);
		await request(
			"POST",
			path + "/facts",
			{
				expectedRevision: now.revision,
				definitionRevisionId: meanings.credit.revisionId,
				replaces: { semanticId: inlineRow.semanticId, headVersion: restored.headVersion },
				nodes: nodesFor("restore-purpose-change"),
			},
			422,
			owner,
		);
	});
	covered("restore-then-assertion-replacement-still-cannot-change-purpose");

	const replacedAssertion = await writeFact(
		reference,
		owner,
		meanings.credit.revisionId,
		"replaced-assertion",
		assertion,
	);
	assert.equal((await factRecord(reference, replacedAssertion.id)).purpose, "assertion");
	assertions++;
	const restoredAssertion = CatalogSemanticMutationSchema.parse(
		await request(
			"POST",
			`${path}/semantics/${assertion.semanticId}/restore`,
			CatalogSemanticRestoreSchema.parse({
				expectedRevision: (await current(reference, owner)).revision,
				expectedHeadVersion: replacedAssertion.headVersion,
				restoreVersion: 1,
			}),
			200,
			owner,
		),
	);
	assert.equal((await factRecord(reference, assertion.id)).purpose, "assertion");
	assert.equal(restoredAssertion.semanticId, assertion.semanticId);
	assertions += 2;
	covered("assertion-purpose-immutable-across-replacement-and-restore");

	await rejectedWithoutMutation(reference, owner, async () => {
		const now = await current(reference, owner);
		await request(
			"POST",
			path + "/relations",
			{
				expectedRevision: now.revision,
				definitionRevisionId: meanings.predicate.revisionId,
				participants: participants(publicActor.reference),
				qualifiers: [
					{ definitionRevisionId: meanings.credit.revisionId, nodes: nodesFor("kept") },
					{
						definitionRevisionId: meanings.note.revisionId,
						nodes: [
							{
								position: 0,
								parentPosition: null,
								parentKind: null,
								memberKey: null,
								kind: "number",
								textValue: null,
								numberValue: "1",
								booleanValue: null,
							},
						],
					},
				],
			},
			422,
			owner,
		);
	});
	covered("malformed-inline-batch-rolls-back-facts-relation-head-owner-revision");

	console.log(
		JSON.stringify({
			check: "catalog-qualifier-privacy",
			assertions,
			limits: QUALIFIER_LIMITS,
			coverage,
			atlasPattern: "loopback rezics_atlas or rezics_atlas_* ; never 15432",
			intendedTarget: "127.0.0.1:25435/rezics_atlas_native_api_20260908",
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
