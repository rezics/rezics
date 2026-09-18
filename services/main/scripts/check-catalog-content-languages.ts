import {
	catalogDefinition,
	catalogDefinitionRevision,
} from "@rezics/schema/postgres/catalog/identity";
import { beginCatalogFact, CatalogRevisionConflict } from "../src/services/catalog/storage";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import {
	contentLanguageDeclarationSemanticId,
	ContentLanguageDeclarationReferenceSchema,
} from "../src/services/catalog/content-language-declaration";
import assert from "node:assert/strict";
import Elysia from "elysia";
import { inArray } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogCreatedSchema } from "../src/services/catalog/resource-contracts";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { unitContentLanguageSupport } from "../src/services/database/schema";
import {
	ContentLanguageDeclarationSchema,
	ContentLanguageDeclarationMutationSchema,
	ContentLanguageDeclarationHistorySchema,
	ContentLanguageDeclarationHistoryValueSchema,
} from "../src/services/catalog/content-language-declaration";
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
		name: "rezics-catalog-content-languages-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { resolveIdentity } = await import("../src/services/auth/session");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: languages } = await import("../src/services/api/catalog/content-languages");
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" })
	.use(errors)
	.use(catalog)
	.group("/catalog", (app) => app.use(languages));
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
try {
	const owner = await actor(),
		other = await actor();
	const targets = [
		await create({ kind: "text_version", name: name("Language text"), languageTag: "ja" }, owner),
		await create({ kind: "release_group", name: name("Language release group") }, owner),
		await create(
			{
				kind: "program",
				name: name("Language program"),
				structure: { shape: "program", fields: {} },
			},
			owner,
		),
		await create({ kind: "software_content", name: name("Language software") }, owner),
	];
	for (const resource of targets) {
		const path = `/catalog/resources/${resource.reference.owner}/${resource.reference.id}/content-language-support`;
		let current = ContentLanguageDeclarationSchema.parse(
			await request("GET", path, undefined, 200, owner),
		);
		assert.equal(current.headVersion, 0);
		assert.deepEqual(current.value, []);
		assertions += 2;
		await request("GET", path, undefined, 404, other);
		const value = [
			{ languageTag: "en", channels: ["text"] },
			{ languageTag: "ja", channels: ["audio", "subtitle"] },
		];
		const first = ContentLanguageDeclarationMutationSchema.parse(
			await request(
				"PUT",
				path,
				{ expectedRevision: current.revision, expectedHeadVersion: 0, value },
				200,
				owner,
			),
		);
		assert.equal(first.headVersion, 1);
		assert.equal(first.changed, true);
		assert.deepEqual(first.value, value);
		assertions += 3;
		const [projection] = await database
			.select({
				value: unitContentLanguageSupport.value,
				owner: unitContentLanguageSupport.unitKind,
			})
			.from(unitContentLanguageSupport)
			.where(eq(unitContentLanguageSupport.unitId, resource.reference.id));
		assert.equal(projection?.owner, resource.reference.owner);
		assert.deepEqual(projection?.value, value);
		assertions += 2;
		const unchanged = ContentLanguageDeclarationMutationSchema.parse(
			await request(
				"PUT",
				path,
				{ expectedRevision: first.revision, expectedHeadVersion: 1, value },
				200,
				owner,
			),
		);
		assert.equal(unchanged.changed, false);
		assert.equal(unchanged.revision, first.revision);
		assertions += 2;
		await request(
			"PUT",
			path,
			{ expectedRevision: first.revision, expectedHeadVersion: 0, value: [] },
			409,
			owner,
		);
		await request(
			"PUT",
			path,
			{ expectedRevision: first.revision, expectedHeadVersion: 1, value: [] },
			403,
			other,
		);
		await request(
			"PUT",
			path,
			{
				expectedRevision: first.revision,
				expectedHeadVersion: 1,
				value,
				semanticId: crypto.randomUUID(),
			},
			422,
			owner,
		);
		const cleared = ContentLanguageDeclarationMutationSchema.parse(
			await request(
				"PUT",
				path,
				{ expectedRevision: first.revision, expectedHeadVersion: 1, value: [] },
				200,
				owner,
			),
		);
		assert.equal(cleared.headVersion, 2);
		assert.deepEqual(cleared.value, []);
		assertions += 2;
		assert.equal(
			(
				await database
					.select({ id: unitContentLanguageSupport.unitId })
					.from(unitContentLanguageSupport)
					.where(eq(unitContentLanguageSupport.unitId, resource.reference.id))
			).length,
			0,
		);
		assertions++;
		const restored = ContentLanguageDeclarationMutationSchema.parse(
			await request(
				"POST",
				path + "/restore",
				{ expectedRevision: cleared.revision, expectedHeadVersion: 2, restoreHeadVersion: 1 },
				200,
				owner,
			),
		);
		assert.equal(restored.headVersion, 3);
		assert.deepEqual(restored.value, value);
		assertions += 2;
		const repeated = ContentLanguageDeclarationMutationSchema.parse(
			await request(
				"POST",
				path + "/restore",
				{ expectedRevision: restored.revision, expectedHeadVersion: 3, restoreHeadVersion: 1 },
				200,
				owner,
			),
		);
		assert.equal(repeated.headVersion, 4);
		assert.equal(repeated.changed, true);
		assertions += 2;
		const history = ContentLanguageDeclarationHistorySchema.parse(
			await request("GET", path + "/history?limit=2", undefined, 200, owner),
		);
		assert.deepEqual(
			history.items.map((item) => item.version),
			[1, 2],
		);
		assert.equal(history.nextVersion, 2);
		assertions += 2;
		const page = ContentLanguageDeclarationHistorySchema.parse(
			await request("GET", path + "/history?limit=2&afterVersion=2", undefined, 200, owner),
		);
		assert.deepEqual(
			page.items.map((item) => item.version),
			[3, 4],
		);
		assert.equal(page.nextVersion, null);
		assertions += 2;
		const emptyHistory = ContentLanguageDeclarationHistoryValueSchema.parse(
			await request("GET", path + "/history/2", undefined, 200, owner),
		);
		assert.deepEqual(emptyHistory.value, []);
		assertions++;
		await request("GET", path + "/history", undefined, 404, other);
		current = ContentLanguageDeclarationSchema.parse(
			await request("GET", path, undefined, 200, owner),
		);
		assert.equal(current.headVersion, 4);
		assert.deepEqual(current.value, value);
		assertions += 2;
		const nativeReference = ContentLanguageDeclarationReferenceSchema.parse(resource.reference);
		const actorId = accounts[0];
		assert.ok(actorId);
		const [meaning] = await database
			.select({ id: catalogDefinitionRevision.id })
			.from(catalogDefinitionRevision)
			.innerJoin(
				catalogDefinition,
				eq(catalogDefinition.id, catalogDefinitionRevision.definitionId),
			)
			.where(
				and(
					eq(catalogDefinition.namespace, "catalog"),
					eq(catalogDefinition.key, "content_consumption_languages"),
				),
			)
			.orderBy(catalogDefinitionRevision.version)
			.limit(1);
		assert.ok(meaning);
		const identity = await resolveIdentity(
			new Request("http://localhost:3001", { headers: { Cookie: owner } }),
			"unit:update",
		);
		if (!("participation" in identity))
			throw new Error("Fixture actor requires participation");
		await assert.rejects(
			runWithParticipationAuthority(identity.participation, () =>
				database.transaction((tx) =>
					beginCatalogFact(tx, nativeReference, actorId, current.revision, meaning.id, {
						initialSemanticId: contentLanguageDeclarationSemanticId(nativeReference),
						expectedHeadVersion: 0,
					}),
				),
			),
			CatalogRevisionConflict,
		);
		assertions++;
		const afterRejected = ContentLanguageDeclarationSchema.parse(
			await request("GET", path, undefined, 200, owner),
		);
		assert.equal(afterRejected.revision, current.revision);
		assert.equal(afterRejected.headVersion, 4);
		assertions += 2;
	}
	const program = targets.find((item) => item.reference.owner === "program");
	assert.ok(program);
	const episode = await create(
		{
			kind: "program",
			name: name("Episode language evidence"),
			structure: { shape: "episode", fields: { programId: program.reference.id } },
		},
		owner,
	);
	const evidence = z
		.object({
			currentContentLanguageSupport: z.array(z.unknown()),
			items: z.array(
				z.object({
					reference: z.object({ owner: z.string(), id: z.string() }),
					contentLanguageSupport: z.array(z.unknown()),
				}),
			),
			nextCursor: z.null(),
		})
		.parse(
			await request(
				"GET",
				`/catalog/resources/program/${episode.reference.id}/content-language-support/evidence`,
				undefined,
				200,
				owner,
			),
		);
	assert.deepEqual(evidence.currentContentLanguageSupport, []);
	assert.equal(evidence.items.length, 1);
	assert.equal(evidence.items[0]?.reference.id, program.reference.id);
	assertions += 3;
	console.log(
		JSON.stringify({
			check: "catalog-content-languages",
			assertions,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
