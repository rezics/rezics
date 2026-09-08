import assert from "node:assert/strict";
import Elysia from "elysia";
import { and, eq, inArray, lt, desc, sql } from "drizzle-orm";
import { studioAuthEditorCandidate } from "../src/services/database/schema/studio";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { CatalogOwnerValues } from "@rezics/reference";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogCreatedSchema } from "../src/services/catalog/resource-contracts";
import { z } from "zod";
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
		name: "rezics-studio-native-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: usersApi } = await import("../src/services/api/users");
const { resolveIdentity } = await import("../src/services/auth/session");
const { issueParticipationGrant, revokeParticipationGrant } = await import(
	"../src/services/participation/commands"
);
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog).use(usersApi);
api.compile();
const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
async function actor() {
	const account = await database.transaction(async (tx) => {
		const [row] = await tx
			.insert(users)
			.values({
				name: "Native domain API fixture",
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
	selection?: { actingEntityId: string; grant: { id: string; revision: number } },
) {
	const headers = new Headers({ Accept: "application/json" });
	if (cookie) headers.set("Cookie", cookie);
	if (selection) headers.set("X-Rezics-Participation", JSON.stringify(selection));
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
const name = (value: string) => ({ languageTag: "en-GB", value });
const pageSchema = z.object({
	items: z.array(
		z.object({
			id: z.uuid(),
			resourceOwner: z.enum(CatalogOwnerValues),
			resourceShape: z.string(),
			language: z.string().nullable(),
			title: z.string().nullable(),
			accessSources: z.array(z.string()),
		}),
	),
	nextCursor: z.string().nullable(),
});
try {
	await assert.rejects(
		database.transaction((tx) =>
			tx.execute(
				sql`select * from public.repair_studio_catalog_creator_candidates('publishing',null,null)`,
			),
		),
	);
	assertions++;
	const owner = await actor(),
		other = await actor();
	const resources = [
		await create({ kind: "text_version", name: name("Studio text"), languageTag: "ja" }, owner),
		await create({ kind: "release_group", name: name("Studio music") }, owner),
		await create(
			{
				kind: "program",
				name: name("Studio program"),
				structure: { shape: "program", fields: {} },
			},
			owner,
		),
		await create({ kind: "software_content", name: name("Studio software") }, owner),
		await create({ kind: "entity", shape: "person", name: name("Studio entity") }, owner),
		await create({ kind: "grouping", name: name("Studio grouping") }, owner),
		await create(
			{ kind: "reference", name: name("Studio reference"), profile: { shape: "concept" } },
			owner,
		),
		await create({ kind: "distribution", name: name("Studio distribution") }, owner),
	];
	const expected = new Map(
		resources.map((resource) => [resource.reference.id, resource.reference.owner]),
	);
	const seen = new Set<string>();
	let cursor: string | null = null;
	for (let pageNumber = 0; pageNumber < 32; pageNumber++) {
		const path =
			"/account/me/studio?source=created&limit=2" +
			(cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
		const page = pageSchema.parse(await request("GET", path, undefined, 200, owner));
		for (const row of page.items) {
			assert.equal(seen.has(row.id), false);
			seen.add(row.id);
			assertions++;
			if (!expected.has(row.id)) continue;
			assert.equal(row.resourceOwner, expected.get(row.id));
			assert.deepEqual(row.accessSources, ["catalog_creator"]);
			assert.equal(row.language, "en-GB");
			assertions += 3;
		}
		cursor = page.nextCursor;
		if (!cursor) break;
	}
	assert.equal(cursor, null);
	assertions++;
	assert.equal(
		resources.every((resource) => seen.has(resource.reference.id)),
		true,
	);
	assertions++;
	const foreign = pageSchema.parse(
		await request("GET", "/account/me/studio?source=created", undefined, 200, other),
	);
	assert.equal(
		foreign.items.some((row) => expected.has(row.id)),
		false,
	);
	assertions++;
	const projection = await database
		.select({
			id: studioAuthEditorCandidate.unitId,
			creator: studioAuthEditorCandidate.catalogCreatorSince,
			owner: studioAuthEditorCandidate.ownerSince,
		})
		.from(studioAuthEditorCandidate)
		.where(inArray(studioAuthEditorCandidate.unitId, [...expected.keys()]));
	assert.equal(projection.length, 8);
	assert.equal(
		projection.every((row) => row.creator !== null && row.owner === null),
		true,
	);
	assertions += 2;
	const target = resources[0]!;
	const ownerIdentity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: owner } }),
		"account:read",
	);
	const otherIdentity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: other } }),
		"account:read",
	);
	if (!ownerIdentity.participation || !otherIdentity.participation)
		throw new Error("Fixture actors require participation");
	const grant = await database.transaction((tx) =>
		issueParticipationGrant(tx, ownerIdentity.participation, {
			recipient: { kind: "auth", authUserId: accounts[1]! },
			actingEntityId: otherIdentity.participation.actingEntityId,
			capability: "catalog.edit",
			target: target.reference,
		}),
	);
	const selection = { actingEntityId: otherIdentity.participation.actingEntityId, grant };
	const inactiveGrant = pageSchema.parse(
		await request("GET", "/account/me/studio?source=direct", undefined, 200, other),
	);
	assert.equal(
		inactiveGrant.items.some((row) => row.id === target.reference.id),
		false,
	);
	assertions++;
	const activeGrant = pageSchema.parse(
		await request("GET", "/account/me/studio?source=direct", undefined, 200, other, selection),
	);
	assert.equal(activeGrant.items.length, 1);
	assert.equal(activeGrant.items[0]?.id, target.reference.id);
	assert.deepEqual(activeGrant.items[0]?.accessSources, ["catalog_grant"]);
	assertions += 3;
	await database.transaction((tx) =>
		revokeParticipationGrant(tx, ownerIdentity.participation, grant.id, grant.revision),
	);
	await request("GET", "/account/me/studio?source=direct", undefined, 403, other, selection);
	for (const resource of resources) {
		const table = CatalogIdentityTables[resource.reference.owner];
		const [previous] = await database
			.select({ id: table.id })
			.from(table)
			.where(lt(table.id, resource.reference.id))
			.orderBy(desc(table.id))
			.limit(1);
		await database.transaction(async (tx) => {
			await tx
				.delete(studioAuthEditorCandidate)
				.where(
					and(
						eq(studioAuthEditorCandidate.unitId, resource.reference.id),
						eq(studioAuthEditorCandidate.authUserId, accounts[0]!),
					),
				);
			const result = await tx.execute(
				sql`select * from public.repair_studio_catalog_creator_candidates(${resource.reference.owner},${previous?.id ?? null}::uuid,1)`,
			);
			const [page] = z
				.array(z.object({ last_id: z.uuid(), scanned: z.number(), exhausted: z.boolean() }))
				.parse(result.rows);
			assert.equal(page?.last_id, resource.reference.id);
			assert.equal(page?.scanned, 1);
			assertions += 2;
			const [restored] = await tx
				.select({ creator: studioAuthEditorCandidate.catalogCreatorSince })
				.from(studioAuthEditorCandidate)
				.where(
					and(
						eq(studioAuthEditorCandidate.unitId, resource.reference.id),
						eq(studioAuthEditorCandidate.authUserId, accounts[0]!),
					),
				);
			assert.ok(restored?.creator);
			assertions++;
		});
	}
	console.log(
		JSON.stringify({
			check: "studio-native",
			assertions,
			owners: 8,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
