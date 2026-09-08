import assert from "node:assert/strict";
import Elysia from "elysia";
import { inArray } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogCreatedSchema } from "../src/services/catalog/resource-contracts";
import { createPortableTextDocument } from "@rezics/block";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { post, label, audio, video } from "../src/services/database/schema";
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
		name: "rezics-content-structure-native-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: structures } = await import("../src/services/api/content-structure");
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog).use(structures);
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
const draftSchema = z.object({
	structureId: z.uuid(),
	latestRevisionId: z.uuid(),
	revisionCreated: z.boolean(),
	items: z.array(
		z.object({
			id: z.uuid(),
			contentUnitId: z.uuid(),
			contentKind: z.string(),
			title: z.string().nullable(),
		}),
	),
});
const structureSchema = z.object({
	structure: z.object({ id: z.uuid(), latestRevisionId: z.uuid() }),
});
try {
	const owner = await actor(),
		other = await actor();
	const text = await create(
		{ kind: "text_version", name: name("Native text"), languageTag: "en" },
		owner,
	);
	const nestedText = await create(
		{ kind: "text_version", name: name("Nested native text"), languageTag: "ja" },
		owner,
	);
	const created = structureSchema.parse(
		await request(
			"POST",
			`/units/by-id/${text.reference.id}/content-structures`,
			{ kind: "book.contents" },
			200,
			owner,
		),
	);
	const labelNodeId = crypto.randomUUID(),
		chapterNodeId = crypto.randomUUID(),
		nestedNodeId = crypto.randomUUID();
	const textPath = `/publishing/text-versions/${text.reference.id}/content-structure`;
	const body = {
		baseRevisionId: created.structure.latestRevisionId,
		nodes: [
			{
				state: "new",
				id: labelNodeId,
				parentId: null,
				order: 0,
				title: "Part one",
				language: "en",
				contentKind: "label",
			},
			{
				state: "new",
				id: chapterNodeId,
				parentId: labelNodeId,
				order: 0,
				title: "Chapter one",
				language: "en",
				contentKind: "chapter",
				content: createPortableTextDocument([]),
				status: "draft",
			},
			{
				state: "attached",
				id: nestedNodeId,
				parentId: null,
				order: 1,
				contentUnitId: nestedText.reference.id,
			},
		],
	};
	const saved = draftSchema.parse(await request("PUT", textPath, body, 200, owner));
	assert.equal(saved.items.length, 3);
	assertions++;
	assert.equal(saved.items.find((item) => item.id === nestedNodeId)?.title, "Nested native text");
	assertions++;
	const chapter = saved.items.find((item) => item.id === chapterNodeId);
	assert.ok(chapter);
	const [nativePost] = await database
		.select({
			id: post.id,
			kind: post.kind,
			creator: post.createdByAuthUserId,
			subject: post.subjectUnitId,
		})
		.from(post)
		.where(eq(post.id, chapter.contentUnitId));
	assert.equal(nativePost?.kind, "chapter");
	assert.equal(nativePost?.subject, text.reference.id);
	assert.ok(nativePost?.creator);
	assertions += 3;
	const labelItem = saved.items.find((item) => item.id === labelNodeId);
	assert.ok(labelItem);
	assert.equal(
		(
			await database
				.select({ id: label.id })
				.from(label)
				.where(eq(label.id, labelItem.contentUnitId))
		).length,
		1,
	);
	assertions++;
	await request("PUT", textPath, { ...body, baseRevisionId: saved.latestRevisionId }, 403, other);
	await request("PUT", textPath, body, 409, owner);
	const existing = saved.items.map((item, index) => ({
		state: "existing",
		id: item.id,
		parentId: item.id === chapterNodeId ? labelNodeId : null,
		order: item.id === nestedNodeId ? 1 : 0,
		title: item.title ?? `Node ${index}`,
	}));
	const unchanged = draftSchema.parse(
		await request(
			"PUT",
			textPath,
			{ baseRevisionId: saved.latestRevisionId, nodes: existing },
			200,
			owner,
		),
	);
	assert.equal(unchanged.revisionCreated, false);
	assert.equal(unchanged.latestRevisionId, saved.latestRevisionId);
	assertions += 2;
	await request(
		"PUT",
		textPath,
		{
			baseRevisionId: saved.latestRevisionId,
			nodes: existing.map((node) =>
				node.id === nestedNodeId ? { ...node, title: "Forbidden catalog rename" } : node,
			),
		},
		422,
		owner,
	);
	const program = await create(
		{ kind: "program", name: name("Native program"), structure: { shape: "program", fields: {} } },
		owner,
	);
	const programPath = `/program/${program.reference.id}/content-structure`;
	const programSaved = draftSchema.parse(
		await request(
			"PUT",
			programPath,
			{
				base: { kind: "uninitialized" },
				nodes: [
					{
						state: "new",
						id: crypto.randomUUID(),
						parentId: null,
						order: 0,
						title: "Video",
						language: "en",
						contentKind: "video",
					},
					{
						state: "new",
						id: crypto.randomUUID(),
						parentId: null,
						order: 1,
						title: "Audio",
						language: "en",
						contentKind: "audio",
					},
				],
			},
			200,
			owner,
		),
	);
	assert.equal(programSaved.items.length, 2);
	assertions++;
	for (const item of programSaved.items) {
		const table = item.contentKind === "video" ? video : audio;
		assert.equal(
			(await database.select({ id: table.id }).from(table).where(eq(table.id, item.contentUnitId)))
				.length,
			1,
		);
		assertions++;
	}
	await request(
		"GET",
		"/units/book/" + text.reference.id + "/content-structure/nodes",
		undefined,
		404,
		owner,
	);
	await request(
		"GET",
		"/units/media/" + program.reference.id + "/content-structure/nodes",
		undefined,
		404,
		owner,
	);
	console.log(
		JSON.stringify({
			check: "content-structure-native",
			assertions,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
