import assert from "node:assert/strict";
import Elysia from "elysia";
import { and, eq, inArray, sql } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import type { CatalogReference } from "@rezics/reference";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogCreatedSchema, CatalogResourceSchema } from "../src/services/catalog/resource-contracts";
import {
	EntityMeasurementContextMutationSchema,
	EntityMeasurementContextResponseSchema,
	EntityMeasurementContextWriteSchema,
} from "../src/services/catalog/entity-measurement-contracts";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { catalogValueNodes } from "../src/services/catalog/value-nodes";
import {
	WriteCatalogFactSchema,
	CatalogSemanticCreatedSchema,
	CatalogFactSummarySchema,
	catalogSemanticPage,
	CatalogValuePageSchema,
	CatalogQualifierSchema,
} from "../src/services/catalog/semantic-api-contracts";

const connectionString = process.env.DATABASE_URL;
const fixturePort = process.env.REZICS_CATALOG_FIXTURE_PORT;
const fixtureDatabase = process.env.REZICS_CATALOG_FIXTURE_DATABASE;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable API fixture required");
if (!fixturePort || !fixtureDatabase)
	throw new Error("Explicit REZICS_CATALOG_FIXTURE_PORT and REZICS_CATALOG_FIXTURE_DATABASE required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== fixturePort ||
	target.port === "15432" ||
	target.pathname !== `/${fixtureDatabase}` ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires isolated loopback Atlas fixture 127.0.0.1:25435/rezics_atlas_native_api_20260908");

const observability = initializeObservability({
	service: {
		name: "rezics-entity-context-measurements-fixture",
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
const { readEntityContextMeasurements, entityMeasurementSemanticId: semanticIdFor } = await import(
	"../src/services/catalog/entity-context-measurements"
);
const { readNativeEntityMeasurements } = await import(
	"../src/services/catalog/entity-measurements-read"
);
const { default: errors } = await import("../src/services/api/error-boundary");

const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog);
api.compile();
const authContext = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
const coverage: string[] = [];
const unexecuted: string[] = [];

function covered(name: string) {
	coverage.push(name);
}

type Actor = { cookie: string; userId: string; entityId: string };

async function actor(label: string): Promise<Actor> {
	const account = await database.transaction(async (tx) => {
		const [row] = await tx
			.insert(users)
			.values({
				name: label,
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(row);
		const entity = await ensureSelfEntityInTransaction(tx, row);
		return { ...row, entityId: entity.id };
	});
	accounts.push(account.id);
	const session = await authContext.internalAdapter.createSession(account.id);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { cookie, userId: account.id, entityId: account.entityId };
}

function catalogReadRequest(path: string, cookie: string) {
	return new Request(`http://localhost:3001/api/v1${path}`, {
		method: "GET",
		headers: { Accept: "application/json", Cookie: cookie },
	});
}

async function captureCatalogReadIdentity(path: string, cookie: string, fixture: Actor) {
	const resolved = await resolveIdentity(catalogReadRequest(path, cookie), "unit:read");
	const base = {
		path,
		permission: "unit:read" as const,
		cookieHeaderPresent: cookie.length > 0,
		cookieName: cookie.split("=")[0] ?? "",
		fixtureUserId: fixture.userId,
		fixtureEntityId: fixture.entityId,
	};
	if (!("participation" in resolved))
		return {
			...base,
			hasParticipation: false as const,
			principalKind: null,
			principalAuthUserId: null,
			actingEntityId: null,
			entityId: null,
			authorizationRevision: null,
			principalMatchesFixtureUser: false,
			entityMatchesFixtureEntity: false,
		};
	return {
		...base,
		hasParticipation: true as const,
		principalKind: resolved.principal.kind,
		principalAuthUserId: resolved.principal.authUserId,
		actingEntityId: resolved.actingEntityId,
		entityId: resolved.entity.id,
		authorizationRevision: resolved.authorizationRevision,
		principalMatchesFixtureUser: resolved.principal.authUserId === fixture.userId,
		entityMatchesFixtureEntity: resolved.entity.id === fixture.entityId,
	};
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

async function requestOwnerHistorical(path: string, fixture: Actor) {
	const response = await api.fetch(catalogReadRequest(path, fixture.cookie));
	const text = await response.text();
	if (response.status !== 200) {
		const identity = await captureCatalogReadIdentity(path, fixture.cookie, fixture);
		assert.equal(
			response.status,
			200,
			`GET ${path}: ${text.slice(0, 2500)}; catalogRead resolveIdentity(unit:read)=${JSON.stringify(identity)}`,
		);
	}
	assertions++;
	assert.equal(text.includes('"createdByAuthUserId"'), false);
	assertions++;
	return text ? JSON.parse(text) : null;
}

async function loadQualifierRows(ownerId: string, relationId: string) {
	const tables = CatalogFactTables.entity;
	return database
		.select({
			id: tables.relationScope.id,
			valueFactId: tables.relationScope.valueFactId,
			purpose: tables.fact.purpose,
		})
		.from(tables.relationScope)
		.innerJoin(
			tables.fact,
			and(
				eq(tables.fact.ownerId, tables.relationScope.ownerId),
				eq(tables.fact.id, tables.relationScope.valueFactId),
			),
		)
		.where(
			and(
				eq(tables.relationScope.ownerId, ownerId),
				eq(tables.relationScope.relationId, relationId),
			),
		)
		.limit(16);
}

async function create(body: unknown, cookie: string) {
	return CatalogCreatedSchema.parse(await request("POST", "/catalog/resources", body, 200, cookie));
}

const name = (value: string) => ({ languageTag: "en" as const, value });
const factsPage = catalogSemanticPage(CatalogFactSummarySchema);
const qualifiersPage = catalogSemanticPage(CatalogQualifierSchema);
const pathFor = (reference: CatalogReference) =>
	`/catalog/resources/${reference.owner}/${reference.id}`;
const measurementPath = (entityId: string, context: { owner: string; id: string }, maxSpoiler = 0) =>
	`/catalog/entity/${entityId}/measurements/context?contextOwner=${context.owner}&contextId=${context.id}&maxSpoiler=${maxSpoiler}`;

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

async function snapshot(reference: CatalogReference) {
	const tables = CatalogFactTables[reference.owner];
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
	const ownerTable = CatalogIdentityTables[reference.owner];
	const [meta] = await database
		.select({ revision: ownerTable.revision })
		.from(ownerTable)
		.where(eq(ownerTable.id, reference.id))
		.limit(1);
	assert.ok(meta);
	return {
		revision: meta.revision,
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
	work: () => Promise<unknown>,
) {
	const before = await snapshot(reference);
	await work();
	assert.deepEqual(await snapshot(reference), before);
	assertions++;
}

const zeros = {
	heightMillimetres: 0,
	weightGrams: 0,
	bustMillimetres: 0,
	waistMillimetres: 0,
	hipsMillimetres: 0,
};
const allNull = {
	heightMillimetres: null,
	weightGrams: null,
	bustMillimetres: null,
	waistMillimetres: null,
	hipsMillimetres: null,
};

try {
	const schemaMissing = EntityMeasurementContextWriteSchema.safeParse({
		expectedRevision: 1,
		expectedHeadVersion: 0,
		context: { owner: "publishing", id: crypto.randomUUID() },
		values: { heightMillimetres: 1, weightGrams: 1, bustMillimetres: 1, waistMillimetres: 1 },
	});
	assert.equal(schemaMissing.success, false);
	assertions++;
	covered("schema-requires-five-value-fields");

	const schemaNegative = EntityMeasurementContextWriteSchema.safeParse({
		expectedRevision: 1,
		expectedHeadVersion: 0,
		context: { owner: "music", id: crypto.randomUUID() },
		values: { ...zeros, heightMillimetres: -1 },
	});
	assert.equal(schemaNegative.success, false);
	assertions++;
	covered("schema-rejects-negative-values");

	const schemaSpoiler = EntityMeasurementContextWriteSchema.safeParse({
		expectedRevision: 1,
		expectedHeadVersion: 0,
		context: { owner: "program", id: crypto.randomUUID() },
		spoiler: 3,
		values: zeros,
	});
	assert.equal(schemaSpoiler.success, false);
	assertions++;
	covered("schema-rejects-spoiler-outside-0-2");

	const schemaHead = EntityMeasurementContextWriteSchema.safeParse({
		expectedRevision: 1,
		expectedHeadVersion: -1,
		context: { owner: "software", id: crypto.randomUUID() },
		values: zeros,
	});
	assert.equal(schemaHead.success, false);
	assertions++;
	covered("schema-rejects-negative-head-version");

	const schemaNulls = EntityMeasurementContextWriteSchema.safeParse({
		expectedRevision: 1,
		expectedHeadVersion: 0,
		context: { owner: "publishing", id: crypto.randomUUID() },
		values: allNull,
	});
	assert.equal(schemaNulls.success, true);
	assertions++;
	covered("schema-accepts-all-null-values");

	const owner = await actor("Packet34 measurement owner"),
		stranger = await actor("Packet34 measurement stranger");
	const mark = crypto.randomUUID();
	const character = await create(
		{ kind: "entity", shape: "character", name: name(`Packet34 character ${mark}`) },
		owner.cookie,
	);
	const publishing = await create(
		{ kind: "publishing_work", name: name(`Packet34 publishing ${mark}`) },
		owner.cookie,
	);
	const music = await create(
		{ kind: "release_group", name: name(`Packet34 music ${mark}`) },
		owner.cookie,
	);
	const program = await create(
		{
			kind: "program",
			name: name(`Packet34 program ${mark}`),
			structure: { shape: "program", fields: {} },
		},
		owner.cookie,
	);
	const software = await create(
		{ kind: "software_content", name: name(`Packet34 software ${mark}`) },
		owner.cookie,
	);
	assert.equal(character.reference.owner, "entity");
	assert.equal(publishing.reference.owner, "publishing");
	assert.equal(music.reference.owner, "music");
	assert.equal(program.reference.owner, "program");
	assert.equal(software.reference.owner, "software");
	assertions += 5;
	covered("created-character-and-four-context-owners");

	await publishWithVisibility(character.reference, owner.cookie, "public");
	await publishWithVisibility(publishing.reference, owner.cookie, "public");
	await publishWithVisibility(music.reference, owner.cookie, "public");
	await publishWithVisibility(program.reference, owner.cookie, "public");
	await publishWithVisibility(software.reference, owner.cookie, "private");

	const identity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: owner.cookie } }),
		"account:read",
	);
	if (!("participation" in identity) || !identity.entity)
		throw new Error("Fixture definitions require current Entity participation from a BetterAuth session");
	assert.equal(identity.participation.actingEntityId, owner.entityId);
	assertions++;
	covered("resolveIdentity-narrows-to-session-entity-not-public-catalog-entity");

	const heightDefinition = await runWithParticipationAuthority(identity.participation, () =>
		database.transaction(async (tx) => {
			await requireParticipation(tx, identity.participation, "entity.security", {
				owner: "entity",
				id: identity.participation.actingEntityId,
			});
			return ensureCatalogDefinition(tx, {
				namespace: "catalog",
				key: "character.height",
				kind: "property",
				valueKind: "number",
				constraints: { integer: true, nullable: true, minimum: 0, unit: "cm" },
			});
		}),
	);

	const characterMeta = await current(character.reference, owner.cookie);
	const globalFact = CatalogSemanticCreatedSchema.parse(
		await request(
			"POST",
			pathFor(character.reference) + "/facts",
			WriteCatalogFactSchema.parse({
				expectedRevision: characterMeta.revision,
				definitionRevisionId: heightDefinition.revisionId,
				nodes: [...catalogValueNodes(170)],
			}),
			200,
			owner.cookie,
		),
	);
	assert.ok(globalFact.id);
	assertions++;
	covered("manual-global-assertion-retained-separately");

	const afterGlobal = await current(character.reference, owner.cookie);
	const createBody = EntityMeasurementContextWriteSchema.parse({
		expectedRevision: afterGlobal.revision,
		expectedHeadVersion: 0,
		context: publishing.reference,
		spoiler: 0,
		values: zeros,
	});
	const createdPublishing = EntityMeasurementContextMutationSchema.parse(
		await request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			createBody,
			200,
			owner.cookie,
		),
	);
	assert.equal(createdPublishing.headVersion, 1);
	assert.equal(
		createdPublishing.semanticId,
		semanticIdFor(character.reference.id, {
			owner: "publishing",
			id: publishing.reference.id,
		}),
	);
	assertions += 2;
	covered("put-create-head-version-0-to-1");

	const readZeros = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, publishing.reference),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(readZeros.canEdit, true);
	assert.equal(readZeros.headVersion, 1);
	assert.ok(readZeros.measurement);
	assert.deepEqual(readZeros.measurement.values, zeros);
	assertions += 4;
	covered("zero-values-retained");

	const afterPublishing = await current(character.reference, owner.cookie);
	const mixed = {
		heightMillimetres: 1600,
		weightGrams: null,
		bustMillimetres: 0,
		waistMillimetres: 580,
		hipsMillimetres: null,
	};
	const createdMusic = EntityMeasurementContextMutationSchema.parse(
		await request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			EntityMeasurementContextWriteSchema.parse({
				expectedRevision: afterPublishing.revision,
				expectedHeadVersion: 0,
				context: music.reference,
				values: mixed,
			}),
			200,
			owner.cookie,
		),
	);
	assert.equal(createdMusic.headVersion, 1);
	assert.notEqual(createdMusic.semanticId, createdPublishing.semanticId);
	assertions += 2;
	covered("own-context-distinct-semantic-id");

	const readMusic = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, music.reference),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.deepEqual(readMusic.measurement?.values, mixed);
	assertions++;
	const readPublishingUnchanged = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, publishing.reference),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.deepEqual(readPublishingUnchanged.measurement?.values, zeros);
	assertions++;
	covered("null-and-zero-retained-per-context");

	const afterMusic = await current(character.reference, owner.cookie);
	const replacedPublishing = EntityMeasurementContextMutationSchema.parse(
		await request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			EntityMeasurementContextWriteSchema.parse({
				expectedRevision: afterMusic.revision,
				expectedHeadVersion: 1,
				context: publishing.reference,
				values: {
					heightMillimetres: 1800,
					weightGrams: 62000,
					bustMillimetres: null,
					waistMillimetres: null,
					hipsMillimetres: null,
				},
			}),
			200,
			owner.cookie,
		),
	);
	assert.equal(replacedPublishing.headVersion, 2);
	assert.equal(replacedPublishing.semanticId, createdPublishing.semanticId);
	assert.notEqual(replacedPublishing.id, createdPublishing.id);
	assertions += 3;
	const readReplaced = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, publishing.reference),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(readReplaced.measurement?.values.heightMillimetres, 1800);
	assert.equal(readReplaced.measurement?.values.weightGrams, 62000);
	assertions += 2;
	const readMusicUnchanged = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, music.reference),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.deepEqual(readMusicUnchanged.measurement?.values, mixed);
	assertions++;
	covered("repeated-exact-context-replaces-head");

	await rejectedWithoutMutation(character.reference, () =>
		request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			{
				expectedRevision: afterMusic.revision,
				expectedHeadVersion: 2,
				context: publishing.reference,
				values: zeros,
			},
			409,
			owner.cookie,
		),
	);
	covered("stale-revision-conflict-rolls-back");

	const fresh = await current(character.reference, owner.cookie);
	await rejectedWithoutMutation(character.reference, () =>
		request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			{
				expectedRevision: fresh.revision,
				expectedHeadVersion: 0,
				context: publishing.reference,
				values: zeros,
			},
			409,
			owner.cookie,
		),
	);
	covered("stale-head-version-conflict-rolls-back");

	const afterConflicts = await current(character.reference, owner.cookie);
	await request(
		"PUT",
		`/catalog/entity/${character.reference.id}/measurements/context`,
		{
			expectedRevision: afterConflicts.revision,
			expectedHeadVersion: 0,
			context: publishing.reference,
			values: zeros,
		},
		401,
	);
	covered("anonymous-write-forbidden");
	const stillAfterAnonymous = await current(character.reference, owner.cookie);
	assert.equal(stillAfterAnonymous.revision, afterConflicts.revision);
	assertions++;

	await request(
		"PUT",
		`/catalog/entity/${character.reference.id}/measurements/context`,
		{
			expectedRevision: stillAfterAnonymous.revision,
			expectedHeadVersion: 2,
			context: publishing.reference,
			values: zeros,
		},
		403,
		stranger.cookie,
	);
	covered("unauthorized-session-write-forbidden");

	const beforeProgram = await current(character.reference, owner.cookie);
	EntityMeasurementContextMutationSchema.parse(
		await request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			EntityMeasurementContextWriteSchema.parse({
				expectedRevision: beforeProgram.revision,
				expectedHeadVersion: 0,
				context: program.reference,
				spoiler: 2,
				values: {
					heightMillimetres: 1500,
					weightGrams: 48000,
					bustMillimetres: 700,
					waistMillimetres: 500,
					hipsMillimetres: 780,
				},
			}),
			200,
			owner.cookie,
		),
	);
	const spoilerHidden = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, program.reference, 0),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(spoilerHidden.measurement, null);
	assertions++;
	const spoilerVisible = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, program.reference, 2),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(spoilerVisible.measurement?.values.heightMillimetres, 1500);
	assert.equal(spoilerVisible.measurement?.spoiler, 2);
	assertions += 2;
	covered("spoiler-2-hidden-at-max-0");

	const beforeSoftware = await current(character.reference, owner.cookie);
	const createdSoftware = EntityMeasurementContextMutationSchema.parse(
		await request(
			"PUT",
			`/catalog/entity/${character.reference.id}/measurements/context`,
			EntityMeasurementContextWriteSchema.parse({
				expectedRevision: beforeSoftware.revision,
				expectedHeadVersion: 0,
				context: software.reference,
				values: allNull,
			}),
			200,
			owner.cookie,
		),
	);
	assert.equal(createdSoftware.headVersion, 1);
	assertions++;
	covered("all-null-contextual-head-created");

	const ownerPrivate = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, software.reference),
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.ok(ownerPrivate.measurement);
	assert.deepEqual(ownerPrivate.measurement.values, allNull);
	assertions += 2;
	await request(
		"GET",
		measurementPath(character.reference.id, software.reference),
		undefined,
		404,
		stranger.cookie,
	);
	await request(
		"GET",
		measurementPath(character.reference.id, software.reference),
		undefined,
		404,
	);
	covered("private-context-hidden-from-public-and-stranger");

	await publishWithVisibility(software.reference, owner.cookie, "public");
	const publicPublishing = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, publishing.reference),
			undefined,
			200,
		),
	);
	assert.ok(publicPublishing.measurement);
	assert.equal(publicPublishing.canEdit, false);
	assertions += 2;
	covered("anonymous-reads-public-context-measurement");
	const publicSoftware = EntityMeasurementContextResponseSchema.parse(
		await request(
			"GET",
			measurementPath(character.reference.id, software.reference),
			undefined,
			200,
			stranger.cookie,
		),
	);
	assert.ok(publicSoftware.measurement);
	assert.equal(publicSoftware.canEdit, false);
	assert.deepEqual(publicSoftware.measurement.values, allNull);
	assertions += 3;
	covered("publish-context-lifecycle-makes-measurement-public");

	await publishWithVisibility(software.reference, owner.cookie, "private");
	await request(
		"GET",
		measurementPath(character.reference.id, software.reference),
		undefined,
		404,
		stranger.cookie,
	);
	covered("unpublish-context-lifecycle-restores-privacy");

	const listedFacts = factsPage.parse(
		await request("GET", `${pathFor(character.reference)}/facts`, undefined, 200, owner.cookie),
	);
	assert.equal(
		listedFacts.items.some((row) => row.id === globalFact.id),
		true,
	);
	assertions++;
	const currentQualifierListPath = `${pathFor(character.reference)}/relations/${replacedPublishing.id}/qualifiers`;
	const historicalQualifierListPath = `${pathFor(character.reference)}/relations/${createdPublishing.id}/qualifiers`;
	const currentQualifierPage = qualifiersPage.parse(
		await request("GET", currentQualifierListPath, undefined, 200, owner.cookie),
	);
	assert.equal(currentQualifierPage.items.length, 5);
	assert.equal(
		currentQualifierPage.items.every((row) => row.valueFactPurpose === "qualifier"),
		true,
	);
	assertions += 2;
	covered("http-qualifier-list-returns-five-qualifier-facts");
	const historicalQualifierPage = qualifiersPage.parse(
		await requestOwnerHistorical(historicalQualifierListPath, owner),
	);
	assert.equal(historicalQualifierPage.items.length, 5);
	assert.equal(
		historicalQualifierPage.items.every((row) => row.valueFactPurpose === "qualifier"),
		true,
	);
	assertions += 2;
	covered("owner-reads-historical-relation-qualifiers");

	const historicalQualifierRows = await loadQualifierRows(
		character.reference.id,
		createdPublishing.id,
	);
	assert.equal(historicalQualifierRows.length, 5);
	assert.equal(
		historicalQualifierRows.every((row) => row.purpose === "qualifier"),
		true,
	);
	assertions += 2;
	const currentQualifierRows = await loadQualifierRows(
		character.reference.id,
		replacedPublishing.id,
	);
	assert.equal(currentQualifierRows.length, 5);
	assert.equal(
		currentQualifierRows.every((row) => row.purpose === "qualifier"),
		true,
	);
	assertions += 2;
	const historicalQualifierFactIds = historicalQualifierRows.map((row) => row.valueFactId);
	const currentQualifierFactIds = currentQualifierRows.map((row) => row.valueFactId);
	assert.equal(
		currentQualifierFactIds.some((id) => historicalQualifierFactIds.includes(id)),
		false,
	);
	assertions++;
	const qualifierFactIds = [...historicalQualifierFactIds, ...currentQualifierFactIds];
	assert.equal(
		listedFacts.items.some((row) => qualifierFactIds.includes(row.id)),
		false,
	);
	assertions++;
	const publicFacts = factsPage.parse(
		await request("GET", `${pathFor(character.reference)}/facts`, undefined, 200),
	);
	assert.equal(
		publicFacts.items.some((row) => qualifierFactIds.includes(row.id)),
		false,
	);
	assertions++;
	covered("public-and-owner-fact-lists-hide-qualifier-only");

	const historicalQualifier = historicalQualifierRows[0];
	const currentQualifier = currentQualifierRows[0];
	assert.ok(historicalQualifier);
	assert.ok(currentQualifier);
	await request(
		"GET",
		`${pathFor(character.reference)}/facts/${historicalQualifier.valueFactId}/nodes`,
		undefined,
		404,
		owner.cookie,
	);
	covered("qualifier-nodes-inaccessible-without-relationId");
	const historicalOwnerNodes = CatalogValuePageSchema.parse(
		await requestOwnerHistorical(
			`${pathFor(character.reference)}/facts/${historicalQualifier.valueFactId}/nodes?relationId=${createdPublishing.id}`,
			owner,
		),
	);
	assert.ok(historicalOwnerNodes.items.length >= 1);
	assertions++;
	covered("exact-owning-relationId-authorizes-qualifier-nodes");
	const currentOwnerNodes = CatalogValuePageSchema.parse(
		await request(
			"GET",
			`${pathFor(character.reference)}/facts/${currentQualifier.valueFactId}/nodes?relationId=${replacedPublishing.id}`,
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.ok(currentOwnerNodes.items.length >= 1);
	assertions++;
	covered("current-owning-relationId-authorizes-owner-qualifier-nodes");
	await request(
		"GET",
		`${pathFor(character.reference)}/facts/${historicalQualifier.valueFactId}/nodes?relationId=${createdMusic.id}`,
		undefined,
		404,
		owner.cookie,
	);
	covered("unrelated-relationId-cannot-read-qualifier-nodes");
	for (const reader of [undefined, stranger.cookie] as const) {
		await request("GET", historicalQualifierListPath, undefined, 404, reader);
		const publicCurrentQualifiers = qualifiersPage.parse(
			await request("GET", currentQualifierListPath, undefined, 200, reader),
		);
		assert.equal(publicCurrentQualifiers.items.length, 5);
		assertions++;
		await request(
			"GET",
			`${pathFor(character.reference)}/facts/${historicalQualifier.valueFactId}/nodes?relationId=${createdPublishing.id}`,
			undefined,
			404,
			reader,
		);
		const publicCurrentNodes = CatalogValuePageSchema.parse(
			await request(
				"GET",
				`${pathFor(character.reference)}/facts/${currentQualifier.valueFactId}/nodes?relationId=${replacedPublishing.id}`,
				undefined,
				200,
				reader,
			),
		);
		assert.ok(publicCurrentNodes.items.length >= 1);
		assertions++;
	}
	covered("public-readers-require-current-relation");
	covered("historical-relation-hidden-from-public-qualifier-nodes");
	covered("public-relation-authorizes-public-qualifier-nodes");
	await request(
		"GET",
		`${pathFor(character.reference)}/facts/${currentQualifier.valueFactId}/nodes`,
		undefined,
		404,
	);
	await request(
		"GET",
		`${pathFor(character.reference)}/facts/${historicalQualifier.valueFactId}/nodes`,
		undefined,
		404,
	);
	covered("public-lists-and-bare-fact-reads-do-not-leak-qualifier-nodes");

	const assertionHistory = await request(
		"GET",
		`${pathFor(character.reference)}/semantics/${globalFact.semanticId}/history`,
		undefined,
		200,
		owner.cookie,
	);
	assert.ok(assertionHistory);
	assertions++;
	covered("manual-assertion-history-retained");

	await runWithParticipationAuthority(identity.participation, () =>
		database.transaction(async (tx) => {
			const exact = await readEntityContextMeasurements(
				tx,
				[character.reference.id],
				owner.userId,
				{ owner: "software", id: software.reference.id },
			);
			const contextual = exact.get(character.reference.id);
			assert.ok(contextual);
			assert.deepEqual(contextual.values, allNull);
			assertions += 2;
			const global = await readNativeEntityMeasurements(tx, [character.reference.id]);
			const native = global.get(character.reference.id);
			assert.ok(native);
			assert.equal(native.heightMillimetres, 1700);
			assert.equal(native.contextUnitId, null);
			assertions += 3;
			covered("all-null-contextual-head-is-override-not-global-fallback");

			const publishingExact = await readEntityContextMeasurements(
				tx,
				[character.reference.id],
				owner.userId,
				{ owner: "publishing", id: publishing.reference.id },
			);
			const musicExact = await readEntityContextMeasurements(
				tx,
				[character.reference.id],
				owner.userId,
				{ owner: "music", id: music.reference.id },
			);
			assert.equal(
				publishingExact.get(character.reference.id)?.values.heightMillimetres,
				1800,
			);
			assert.deepEqual(musicExact.get(character.reference.id)?.values, mixed);
			assert.notEqual(
				publishingExact.get(character.reference.id)?.semanticId,
				musicExact.get(character.reference.id)?.semanticId,
			);
			assertions += 3;
			covered("service-reader-requires-exact-context-relation");
		}),
	);

	unexecuted.push(
		"http-subject-association-card-hydration: no catalog HTTP association setup; contextual reader exactness proven at readEntityContextMeasurements",
	);
	unexecuted.push(
		"service-reader-malformed-participant-bindings: write path always stores subject+context pair; skip-if-not-exactly-two-members not HTTP-injected",
	);

	console.log(
		JSON.stringify({
			check: "entity-context-measurements",
			assertions,
			coverage,
			unexecuted,
			atlas: `${target.hostname}:${target.port}${target.pathname}`,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
