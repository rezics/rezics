import assert from "node:assert/strict";
import Elysia from "elysia";
import { inArray } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { ensureCatalogDefinition } from "../src/services/catalog/storage";
import { CatalogCreatedSchema } from "../src/services/catalog/resource-contracts";
import {
	PublishingDetailsSchema,
	PublishingMutationSchema,
	PublishingChildSchema,
	PublishingHistorySchema,
	PublishingConnectionSchema,
	publishingPage,
} from "../src/services/catalog/publishing-api-contracts";
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
	service: { name: "rezics-publishing-api-fixture", version: "1.0.0", environment: "tooling" },
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: publishing } = await import("../src/services/api/catalog/publishing");
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" })
	.use(errors)
	.use(catalog)
	.group("/catalog", (app) => app.use(publishing));
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
		new Request(`http://localhost:3001/api/v1/catalog${path}`, {
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
	return CatalogCreatedSchema.parse(await request("POST", "/resources", body, 200, cookie));
}
const name = (value: string) => ({ languageTag: "en", value });
try {
	const owner = await actor(),
		other = await actor();
	const work = await create({ kind: "publishing_work", name: name("Native work") }, owner);
	const publication = await create(
		{
			kind: "publication",
			name: name("Unparented publication"),
			pageCount: 120,
			paginationText: "xii, 120 pages",
		},
		owner,
	);
	const text = await create(
		{ kind: "text_version", name: name("Translated text"), languageTag: "ja" },
		owner,
	);
	const serial = await create(
		{ kind: "serialization", name: name("Serial"), textVersionId: text.reference.id },
		owner,
	);
	const path = (id: string) => `/publishing/${id}`;
	let detail = PublishingDetailsSchema.parse(
		await request("GET", `${path(publication.reference.id)}/details`, undefined, 200, owner),
	);
	assert.equal(detail.structure.shape, "publication");
	assert.equal(detail.canEdit, true);
	assertions += 2;
	await request("GET", `${path(publication.reference.id)}/details`, undefined, 404, other);
	const changed = PublishingMutationSchema.parse(
		await request(
			"PUT",
			`${path(publication.reference.id)}/details`,
			{
				expectedRevision: detail.revision,
				expectedHistoryId: detail.historyId,
				structure: {
					shape: "publication",
					fields: { pageCount: 130, paginationText: "130 pages" },
				},
			},
			200,
			owner,
		),
	);
	await request(
		"PUT",
		`${path(publication.reference.id)}/details`,
		{
			expectedRevision: detail.revision,
			expectedHistoryId: detail.historyId,
			structure: { shape: "publication", fields: { pageCount: 140 } },
		},
		409,
		owner,
	);
	const restored = PublishingMutationSchema.parse(
		await request(
			"POST",
			`${path(publication.reference.id)}/history/publishing_publication/${publication.reference.id}/restore`,
			{
				expectedRevision: changed.revision,
				expectedHistoryId: changed.historyId,
				historyId: detail.historyId,
			},
			200,
			owner,
		),
	);
	detail = PublishingDetailsSchema.parse(
		await request("GET", `${path(publication.reference.id)}/details`, undefined, 200, owner),
	);
	assert.equal(
		detail.structure.shape === "publication" ? detail.structure.fields.pageCount : null,
		120,
	);
	assertions++;
	const coverage = PublishingMutationSchema.parse(
		await request(
			"PUT",
			`${path(publication.reference.id)}/components/publication_work/${work.reference.id}`,
			{
				expectedRevision: restored.revision,
				expectedHistoryId: null,
				value: {
					kind: "publication_work",
					targetId: work.reference.id,
					position: 0,
					coverageText: "Complete",
				},
			},
			200,
			owner,
		),
	);
	const children = publishingPage(PublishingChildSchema).parse(
		await request(
			"GET",
			`${path(publication.reference.id)}/components/publication_work`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(children.items[0]?.name?.value, "Native work");
	assert.equal(children.items[0]?.historyId, coverage.historyId);
	assertions += 2;
	const connections = publishingPage(PublishingConnectionSchema).parse(
		await request(
			"GET",
			`${path(work.reference.id)}/connections?kind=publication_work&direction=incoming`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(connections.items[0]?.id, publication.reference.id);
	assertions++;
	const second = PublishingMutationSchema.parse(
		await request(
			"PUT",
			`${path(publication.reference.id)}/components/publication_text/${text.reference.id}`,
			{
				expectedRevision: coverage.revision,
				expectedHistoryId: null,
				value: { kind: "publication_text", targetId: text.reference.id, position: 1 },
			},
			200,
			owner,
		),
	);
	const eventId = crypto.randomUUID();
	const event = PublishingMutationSchema.parse(
		await request(
			"PUT",
			`${path(publication.reference.id)}/components/event/${eventId}`,
			{
				expectedRevision: second.revision,
				expectedHistoryId: null,
				value: {
					kind: "event",
					publisherCredit: "Publisher as printed",
					date: { year: 2001, month: null, day: null },
				},
			},
			200,
			owner,
		),
	);
	const events = publishingPage(PublishingChildSchema).parse(
		await request(
			"GET",
			`${path(publication.reference.id)}/components/event`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(events.items[0]?.value.kind, "event");
	assertions++;
	const removed = PublishingMutationSchema.parse(
		await request(
			"DELETE",
			`${path(publication.reference.id)}/components/event/${eventId}`,
			{ expectedRevision: event.revision, expectedHistoryId: event.historyId },
			200,
			owner,
		),
	);
	await request(
		"POST",
		`${path(publication.reference.id)}/history/publishing_release_event/${eventId}/restore`,
		{
			expectedRevision: removed.revision,
			expectedHistoryId: removed.historyId,
			historyId: event.historyId,
		},
		200,
		owner,
	);
	await request(
		"GET",
		`${path(publication.reference.id)}/history/publishing_release_event/${eventId}`,
		undefined,
		404,
		other,
	);
	const kind = await database.transaction((tx) =>
		ensureCatalogDefinition(tx, {
			namespace: "catalog.installment_kind",
			key: "chapter",
			kind: "vocabulary",
			valueKind: null,
			constraints: {
				targets: [{ owner: "publishing", shapes: ["serialization"] }],
				slots: ["installment-kind"],
			},
		}),
	);
	const serialDetail = PublishingDetailsSchema.parse(
		await request("GET", `${path(serial.reference.id)}/details`, undefined, 200, owner),
	);
	const installmentId = crypto.randomUUID();
	const installment = PublishingMutationSchema.parse(
		await request(
			"PUT",
			`${path(serial.reference.id)}/components/installment/${installmentId}`,
			{
				expectedRevision: serialDetail.revision,
				expectedHistoryId: null,
				value: {
					kind: "installment",
					position: "a0",
					label: "Chapter one",
					kindRevisionId: kind.revisionId,
					date: { year: 2020, month: 1, day: 1 },
				},
			},
			200,
			owner,
		),
	);
	const parts = publishingPage(PublishingChildSchema).parse(
		await request(
			"GET",
			`${path(serial.reference.id)}/components/installment?limit=1`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(parts.items[0]?.value.kind, "installment");
	assertions++;
	await request(
		"PUT",
		`${path(serial.reference.id)}/components/installment/${installmentId}`,
		{
			expectedRevision: installment.revision,
			expectedHistoryId: installment.historyId,
			value: {
				kind: "installment",
				parentId: installmentId,
				position: "a0",
				kindRevisionId: kind.revisionId,
			},
		},
		422,
		owner,
	);
	const history = publishingPage(PublishingHistorySchema).parse(
		await request(
			"GET",
			`${path(serial.reference.id)}/history/publishing_installment/${installmentId}`,
			undefined,
			200,
			owner,
		),
	);
	assert.equal(history.items[0]?.snapshot.kind, "child");
	assertions++;
	await request(
		"GET",
		`${path(publication.reference.id)}/components/event?cursor=AAAA`,
		undefined,
		422,
		owner,
	);
	await request(
		"GET",
		`${path(publication.reference.id)}/components/publication_work?parentId=${installmentId}`,
		undefined,
		422,
		owner,
	);
	console.log(
		JSON.stringify({ check: "publishing-api", assertions, committedToDisposableTarget: true }),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
