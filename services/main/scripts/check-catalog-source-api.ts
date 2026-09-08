import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { Readable } from "node:stream";
import Elysia from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { z } from "zod";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import {
	catalogSourceProviderBudget,
	catalogSourceRecord,
	catalogSourceSnapshot,
	catalogSourceMappingClaim,
} from "../src/services/database/schema/catalog-source";
import { CatalogOwnerValues } from "../src/services/catalog/contracts";
import {
	CatalogResourceSchema,
	CatalogNamePageSchema,
	CatalogNameCreatedSchema,
	CatalogNamedFormSchema,
	CatalogCursorQuerySchema,
	AddCatalogNameSchema,
	EditCatalogNameSchema,
} from "../src/services/catalog/resource-contracts";
import { CatalogNameInputSchema } from "../src/services/catalog/name-contracts";
import {
	CatalogSourceIntakeResultSchema,
	CatalogResourceBindingsPageSchema,
	CatalogSourceProposalPageSchema,
	CatalogSourceProposeResultSchema,
	CatalogSourceDecisionResultSchema,
	CatalogSourceBindingMutationSchema,
} from "../src/services/catalog/source-api-contracts";
import {
	CatalogSourcePreviewSchema,
	CatalogSourcePreviewValueSchema,
} from "../src/services/catalog/source-preview";
import {
	OpenLibraryWorkSchema,
	OpenLibraryEditionSchema,
	OpenLibraryAuthorSchema,
	OpenLibraryMappingVersion,
} from "../src/services/catalog/openlibrary";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";
import { operationalCapacity } from "../src/services/database/schema/operational-durability";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import type { CatalogSourceArchive } from "../src/services/catalog/source-observations";
import type { CatalogSourceFetch } from "../src/services/catalog/source-acquisition";
import type { CatalogReference } from "@rezics/reference";

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
		name: "rezics-catalog-source-api-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});

const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: session } = await import("../src/services/auth/session");
const { default: errors } = await import("../src/services/api/error-boundary");
const { catalogRead, catalogMutation } = await import("../src/services/api/catalog/transaction");
const { createCatalogSourceApi, resourceSourceBindings } = await import(
	"../src/services/api/catalog/sources"
);
const { readCatalogResource, pageCatalogNames, presentCatalogName } = await import(
	"../src/services/catalog/resources"
);
const { addCatalogName, reviseCatalogName } = await import("../src/services/catalog/names");

const CatalogApiErrorBodySchema = z.strictObject({
	error: z.strictObject({
		code: z.enum([
			"AuthenticationRequired",
			"EmailVerificationRequired",
			"ValidationError",
			"CatalogReferenceNotFound",
			"CatalogRevisionConflict",
			"ParticipationDenied",
			"CatalogSourceUnavailable",
			"CatalogSourceRequestLimited",
			"InternalError",
		]),
		message: z.string(),
		details: z.json().optional(),
	}),
	requestId: z.string().min(1),
});
const NativeIntakeSchema = z.strictObject({
	status: z.enum(["created", "unchanged", "paused", "review_required"]),
	reference: z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() }),
	revision: z.number().int().positive(),
	sourceRecordId: z.uuid(),
	snapshotId: z.uuid(),
	mappingKey: z.uuid(),
});
const namesQuery = CatalogCursorQuerySchema.extend({
	maxSpoiler: z.coerce.number().int().min(0).max(2).default(0),
});
const resourceParams = z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() });
const nameParams = resourceParams.extend({ nameId: z.uuid() });

const olNumber = () => randomInt(1_000_000_000, 2_000_000_000);
const workKey = `/works/OL${olNumber()}W`;
const editionKey = `/books/OL${olNumber()}M`;
const authorKey = `/authors/OL${olNumber()}A`;
const originalTitle = "Source API fixture work";
const revisedTitle = "Source API fixture work revised";
const editionTitle = "Source API fixture edition";
const workRecord = OpenLibraryWorkSchema.parse({
	key: workKey,
	type: { key: "/type/work" },
	title: originalTitle,
});
const editionRecord = OpenLibraryEditionSchema.parse({
	key: editionKey,
	type: { key: "/type/edition" },
	title: editionTitle,
});
OpenLibraryAuthorSchema.parse({
	key: authorKey,
	type: { key: "/type/author" },
	name: "Source API fixture author",
});
const documents = new Map<string, string>([
	[`https://openlibrary.org${workKey}.json`, JSON.stringify(workRecord)],
	[`https://openlibrary.org${editionKey}.json`, JSON.stringify(editionRecord)],
	[
		`https://openlibrary.org${authorKey}.json`,
		JSON.stringify({
			key: authorKey,
			type: { key: "/type/author" },
			name: "Source API fixture author",
		}),
	],
]);
let upstreamCalls = 0;
const fakeFetch: CatalogSourceFetch = async (input) => {
	upstreamCalls += 1;
	const url = input instanceof Request ? input.url : String(input);
	const body = documents.get(url);
	if (body === undefined) return new Response("not found", { status: 404 });
	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(value) {
		objects.set(value.Key, value.Body);
	},
	async get(value) {
		const bytes = objects.get(value.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};

const catalog = new Elysia({ prefix: "/catalog", name: "catalog-source-api-fixture" })
	.use(session)
	.use(createCatalogSourceApi({ archive, fetch: fakeFetch }))
	.use(resourceSourceBindings)
	.get(
		"/resources/:owner/:id",
		{ params: resourceParams, response: CatalogResourceSchema },
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readCatalogResource(tx, params, actor)),
	)
	.get(
		"/resources/:owner/:id/names",
		{ params: resourceParams, query: namesQuery, response: CatalogNamePageSchema },
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageCatalogNames(tx, params, actor, query)),
	)
	.post(
		"/resources/:owner/:id/names",
		{
			access: "contribute:unit:update",
			params: resourceParams,
			body: AddCatalogNameSchema,
			response: CatalogNameCreatedSchema,
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				addCatalogName(tx, params, actor, body.expectedRevision, body.value),
			),
	)
	.put(
		"/resources/:owner/:id/names/:nameId",
		{
			access: "contribute:unit:update",
			params: nameParams,
			body: EditCatalogNameSchema,
			response: CatalogNamedFormSchema,
		},
		({ params, participation, body }) =>
			catalogMutation(participation, async (tx, actor) =>
				presentCatalogName(
					await reviseCatalogName(
						tx,
						params,
						actor,
						params.nameId,
						body.expectedRevision,
						body.value,
					),
				),
			),
	);
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog);
api.compile();
const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;

async function actor(label: string) {
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
		await ensureSelfEntityInTransaction(tx, row);
		return row;
	});
	accounts.push(account.id);
	const sessionRow = await context.internalAdapter.createSession(account.id);
	const [cookie] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			sessionRow.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { account, cookie };
}

async function exchange(
	method: string,
	path: string,
	body: unknown,
	cookie?: string,
): Promise<{ status: number; value: unknown; text: string }> {
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
	assert.equal(text.includes("createdByAuthUserId"), false);
	assert.equal(text.includes("proposerAuthUserId"), false);
	assertions += 2;
	const value: unknown = text ? JSON.parse(text) : null;
	return { status: response.status, value, text };
}

async function request(
	method: string,
	path: string,
	body: unknown,
	expected: number,
	cookie?: string,
) {
	const result = await exchange(method, path, body, cookie);
	assert.equal(result.status, expected, `${method} ${path}: ${result.text.slice(0, 2500)}`);
	assertions++;
	return result.value;
}

async function denied(
	method: string,
	path: string,
	body: unknown,
	expected: number,
	code: z.output<typeof CatalogApiErrorBodySchema>["error"]["code"],
	cookie?: string,
) {
	const value = CatalogApiErrorBodySchema.parse(await request(method, path, body, expected, cookie));
	assert.equal(value.error.code, code, `${method} ${path} code ${value.error.code}`);
	assertions++;
	return value;
}

function nativeIntake(value: unknown) {
	const result = CatalogSourceIntakeResultSchema.parse(value);
	if (result.status === "queued")
		throw new Error("Open Library intake must not enter the Music release job");
	return NativeIntakeSchema.parse(result);
}

function resourcePath(reference: CatalogReference) {
	return `/catalog/resources/${reference.owner}/${reference.id}`;
}

function nameInput(form: z.output<typeof CatalogNamedFormSchema>) {
	return CatalogNameInputSchema.parse({
		value: form.value,
		kind: form.kind,
		sortName: form.sortName,
		languageTag: form.languageTag,
		privateUseNamespace: form.privateUseNamespace,
		origin: form.origin,
		translationMethod: form.translationMethod,
		primaryForLanguage: form.primaryForLanguage,
		scopeOwnerId: form.scopeOwnerId,
		territory: form.territory,
		context: form.context,
		derivationNameId: form.derivationNameId,
		derivationRevision: form.derivationRevision,
		begin: form.begin,
		end: form.end,
		ended: form.ended,
		spoiler: form.spoiler,
		state: form.state,
	});
}

async function listedNames(reference: CatalogReference, cookie: string) {
	return CatalogNamePageSchema.parse(
		await request("GET", `${resourcePath(reference)}/names`, undefined, 200, cookie),
	);
}

async function primaryName(reference: CatalogReference, cookie: string, value: string) {
	const name = (await listedNames(reference, cookie)).items.find(
		(item) => item.kind === "primary" && item.value === value,
	);
	assert.ok(name, `missing primary name ${value}`);
	assertions++;
	return name;
}

async function waitOpenLibraryBudget() {
	const [row] = await database
		.select({
			nextAllowedAt: catalogSourceProviderBudget.nextAllowedAt,
		})
		.from(catalogSourceProviderBudget)
		.where(eq(catalogSourceProviderBudget.source, "openlibrary"))
		.limit(1);
	if (!row) return;
	const delay = row.nextAllowedAt.getTime() - Date.now() + 50;
	if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

async function occupiedOpenLibraryBudget() {
	const [row] = await database
		.select({ nextAllowedAt: catalogSourceProviderBudget.nextAllowedAt })
		.from(catalogSourceProviderBudget)
		.where(eq(catalogSourceProviderBudget.source, "openlibrary"))
		.limit(1);
	return row !== undefined && row.nextAllowedAt.getTime() > Date.now() + 20;
}

async function assertPersisted(
	intake: z.output<typeof NativeIntakeSchema>,
	expected: { source: "openlibrary"; objectType: "work" | "edition"; externalId: string },
) {
	assert.equal(intake.reference.owner, "publishing");
	assert.equal(intake.sourceRecordId, catalogSourceRecordId({ ...expected, source: "openlibrary" }));
	assertions += 2;
	const [record] = await database
		.select()
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, intake.sourceRecordId))
		.limit(1);
	assert.ok(record);
	assert.equal(record.source, expected.source);
	assert.equal(record.objectType, expected.objectType);
	assert.equal(record.externalId, expected.externalId);
	assert.equal(record.headSnapshotId, intake.snapshotId);
	assertions += 5;
	const [snapshot] = await database
		.select()
		.from(catalogSourceSnapshot)
		.where(
			and(
				eq(catalogSourceSnapshot.sourceRecordId, intake.sourceRecordId),
				eq(catalogSourceSnapshot.id, intake.snapshotId),
			),
		)
		.limit(1);
	assert.ok(snapshot);
	assert.ok(objects.has(snapshot.payloadRef));
	assertions += 2;
	const [claim] = await database
		.select()
		.from(catalogSourceMappingClaim)
		.where(
			and(
				eq(catalogSourceMappingClaim.sourceRecordId, intake.sourceRecordId),
				eq(catalogSourceMappingClaim.mappingKey, intake.mappingKey),
			),
		)
		.limit(1);
	assert.ok(claim);
	assert.equal(claim.path, "/");
	assert.equal(claim.mappingVersion, OpenLibraryMappingVersion);
	assert.equal(claim.owner, "publishing");
	assertions += 4;
	const [binding] = await database
		.select()
		.from(CatalogFactTables.publishing.sourceBinding)
		.where(
			and(
				eq(CatalogFactTables.publishing.sourceBinding.sourceRecordId, intake.sourceRecordId),
				eq(CatalogFactTables.publishing.sourceBinding.mappingKey, intake.mappingKey),
			),
		)
		.limit(1);
	assert.ok(binding);
	assert.equal(binding.ownerId, intake.reference.id);
	assertions += 2;
}

try {
	for(const [objectType,externalId] of [["work",workKey],["edition",editionKey],["author",authorKey]] as const) {
		const id=catalogSourceRecordId({source:"openlibrary",objectType,externalId});
		const bucket=aggregateRoutingBucket("source_record",id);
		await database.insert(operationalCapacity).values(["event-outbox","task-outbox","task-intent","receipt"].map(lane=>({routingBucket:bucket,lane,maximumRows:10000n,maximumBytes:128_000_000n}))).onConflictDoNothing();
	}
	const owner = await actor("Source API fixture owner");
	const stranger = await actor("Source API fixture stranger");
	await waitOpenLibraryBudget();

	await denied("POST", "/catalog/sources/intake", { source: "openlibrary", objectType: "work", externalId: workKey }, 401, "AuthenticationRequired");
	await denied(
		"POST",
		"/catalog/sources/intake",
		{ externalURL: "https://attacker.example/works/OL1W.json" },
		422,
		"ValidationError",
		owner.cookie,
	);
	await denied(
		"POST",
		"/catalog/sources/intake",
		{ source: "https://attacker.example", objectType: "work", externalId: workKey },
		422,
		"ValidationError",
		owner.cookie,
	);
	await denied(
		"POST",
		"/catalog/sources/intake",
		{ source: "openlibrary", objectType: "work", externalId: "https://attacker.example/works/OL1W" },
		422,
		"ValidationError",
		owner.cookie,
	);

	const created = nativeIntake(
		await request(
			"POST",
			"/catalog/sources/intake",
			{ source: "openlibrary", objectType: "work", externalId: workKey },
			200,
			owner.cookie,
		),
	);
	assert.equal(created.status, "created");
	assertions++;
	await assertPersisted(created, { source: "openlibrary", objectType: "work", externalId: workKey });
	const metadata = CatalogResourceSchema.parse(
		await request("GET", resourcePath(created.reference), undefined, 200, owner.cookie),
	);
	assert.equal(metadata.visibility, "private");
	assert.equal(metadata.shape, "work");
	assert.equal(metadata.canEdit, true);
	assertions += 3;
	const [identity] = await database
		.select({
			visibility: CatalogIdentityTables.publishing.visibility,
			shape: CatalogIdentityTables.publishing.shape,
			status: CatalogIdentityTables.publishing.status,
		})
		.from(CatalogIdentityTables.publishing)
		.where(eq(CatalogIdentityTables.publishing.id, created.reference.id))
		.limit(1);
	assert.ok(identity);
	assert.equal(identity.visibility, "private");
	assert.equal(identity.shape, "work");
	assert.equal(identity.status, "draft");
	assertions += 4;
	await primaryName(created.reference, owner.cookie, originalTitle);
	const bindings = CatalogResourceBindingsPageSchema.parse(
		await request("GET", `${resourcePath(created.reference)}/source-bindings`, undefined, 200, owner.cookie),
	);
	assert.equal(bindings.items.length, 1);
	assert.equal(bindings.items[0]?.sourceRecordId, created.sourceRecordId);
	assert.equal(bindings.items[0]?.mappingKey, created.mappingKey);
	assert.equal(bindings.items[0]?.mode, "review");
	assert.equal(bindings.items[0]?.state, "active");
	assertions += 5;
	const firstCalls = upstreamCalls;
	assert.ok(firstCalls >= 1);
	assertions++;

	if (await occupiedOpenLibraryBudget()) {
		await denied(
			"POST",
			"/catalog/sources/intake",
			{ source: "openlibrary", objectType: "edition", externalId: editionKey },
			429,
			"CatalogSourceRequestLimited",
			owner.cookie,
		);
	}
	await waitOpenLibraryBudget();

	const cached = nativeIntake(
		await request(
			"POST",
			"/catalog/sources/intake",
			{ source: "openlibrary", objectType: "work", externalId: workKey },
			200,
			owner.cookie,
		),
	);
	assert.equal(cached.status, "unchanged");
	assert.equal(cached.sourceRecordId, created.sourceRecordId);
	assert.equal(cached.snapshotId, created.snapshotId);
	assert.equal(cached.mappingKey, created.mappingKey);
	assert.equal(upstreamCalls, firstCalls);
	assertions += 5;

	await denied(
		"GET",
		`${resourcePath(created.reference)}/source-bindings`,
		undefined,
		404,
		"CatalogReferenceNotFound",
	);
	await denied(
		"GET",
		`${resourcePath(created.reference)}/source-bindings`,
		undefined,
		404,
		"CatalogReferenceNotFound",
		stranger.cookie,
	);
	await denied(
		"GET",
		`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}/proposals`,
		undefined,
		404,
		"CatalogReferenceNotFound",
		stranger.cookie,
	);
	await denied(
		"GET",
		resourcePath(created.reference),
		undefined,
		404,
		"CatalogReferenceNotFound",
		stranger.cookie,
	);

	workRecord.title = revisedTitle;
	OpenLibraryWorkSchema.parse(workRecord);
	documents.set(`https://openlibrary.org${workKey}.json`, JSON.stringify(workRecord));
	await waitOpenLibraryBudget();
	const refreshed = nativeIntake(
		await request(
			"POST",
			`/catalog/sources/intake?refresh=true`,
			{ source: "openlibrary", objectType: "work", externalId: workKey },
			200,
			owner.cookie,
		),
	);
	assert.equal(refreshed.status, "review_required");
	assert.equal(refreshed.reference.id, created.reference.id);
	assert.notEqual(refreshed.snapshotId, created.snapshotId);
	assert.ok(upstreamCalls > firstCalls);
	assertions += 4;
	await primaryName(created.reference, owner.cookie, originalTitle);
	const afterRefresh = CatalogResourceSchema.parse(
		await request("GET", resourcePath(created.reference), undefined, 200, owner.cookie),
	);
	assert.equal(afterRefresh.revision, metadata.revision);
	assertions++;

	const pendingPage = CatalogSourceProposalPageSchema.parse(
		await request(
			"GET",
			`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}/proposals`,
			undefined,
			200,
			owner.cookie,
		),
	);
	const pending = pendingPage.items.find(
		(item) => item.snapshotId === refreshed.snapshotId && item.state === "pending",
	);
	assert.ok(pending);
	assertions++;
	await denied(
		"GET",
		`/catalog/sources/${created.sourceRecordId}/proposals/${pending.id}/preview?action=apply`,
		undefined,
		401,
		"AuthenticationRequired",
	);
	await denied(
		"GET",
		`/catalog/sources/${created.sourceRecordId}/proposals/${pending.id}/preview?action=apply`,
		undefined,
		404,
		"CatalogReferenceNotFound",
		stranger.cookie,
	);
	await denied(
		"GET",
		`/catalog/sources/${created.sourceRecordId}/proposals/${pending.id}/preview/value?action=apply&side=after&path=${encodeURIComponent("/title")}`,
		undefined,
		404,
		"CatalogReferenceNotFound",
		stranger.cookie,
	);
	const preview = CatalogSourcePreviewSchema.parse(
		await request(
			"GET",
			`/catalog/sources/${created.sourceRecordId}/proposals/${pending.id}/preview?action=apply&limit=100`,
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(preview.reference.id, created.reference.id);
	assert.equal(preview.afterSnapshotId, refreshed.snapshotId);
	assert.equal(preview.beforeSnapshotId, created.snapshotId);
	const titleChange = preview.changes.find((change) => change.path === "/title");
	assert.ok(titleChange);
	assert.equal(titleChange.before?.kind, "string");
	assert.equal(titleChange.after?.kind, "string");
	assert.equal(titleChange.before?.text, JSON.stringify(originalTitle));
	assert.equal(titleChange.after?.text, JSON.stringify(revisedTitle));
	assertions += 7;
	const afterTitle = CatalogSourcePreviewValueSchema.parse(
		await request(
			"GET",
			`/catalog/sources/${created.sourceRecordId}/proposals/${pending.id}/preview/value?action=apply&side=after&path=${encodeURIComponent("/title")}`,
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(afterTitle.kind, "string");
	assert.equal(afterTitle.text, JSON.stringify(revisedTitle));
	assert.equal(afterTitle.afterOffset, null);
	assertions += 3;
	const beforeTitle = CatalogSourcePreviewValueSchema.parse(
		await request(
			"GET",
			`/catalog/sources/${created.sourceRecordId}/proposals/${pending.id}/preview/value?action=apply&side=before&path=${encodeURIComponent("/title")}`,
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.equal(beforeTitle.text, JSON.stringify(originalTitle));
	assertions++;

	const proposed = CatalogSourceProposeResultSchema.parse(
		await request(
			"POST",
			`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}/proposals`,
			{ snapshotId: refreshed.snapshotId, mappingVersion: OpenLibraryMappingVersion },
			200,
			owner.cookie,
		),
	);
	assert.equal(proposed.status, "proposed");
	assert.ok(proposed.proposal);
	assert.equal(proposed.proposal.snapshotId, refreshed.snapshotId);
	assertions += 3;
	await denied(
		"POST",
		`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}/proposals`,
		{ snapshotId: refreshed.snapshotId, mappingVersion: "openlibrary.work.1" },
		422,
		"ValidationError",
		owner.cookie,
	);

	const extra = CatalogNameCreatedSchema.parse(
		await request(
			"POST",
			`${resourcePath(created.reference)}/names`,
			{
				expectedRevision: afterRefresh.revision,
				value: { value: "Independent fixture title", kind: "human-title", languageTag: "en" },
			},
			200,
			owner.cookie,
		),
	);
	const staleTarget = CatalogSourceDecisionResultSchema.parse(
		await request(
			"POST",
			`/catalog/sources/${created.sourceRecordId}/proposals/${proposed.proposal.id}/decision`,
			{
				mappingVersion: OpenLibraryMappingVersion,
				action: "apply",
				reason: "Stale native target after an independent name",
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(staleTarget.status, "superseded");
	assertions++;
	await primaryName(created.reference, owner.cookie, originalTitle);

	const reproposed = CatalogSourceProposeResultSchema.parse(
		await request(
			"POST",
			`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}/proposals`,
			{ snapshotId: refreshed.snapshotId, mappingVersion: OpenLibraryMappingVersion },
			200,
			owner.cookie,
		),
	);
	assert.equal(reproposed.status, "proposed");
	assert.ok(reproposed.proposal);
	assertions += 2;
	const applied = CatalogSourceDecisionResultSchema.parse(
		await request(
			"POST",
			`/catalog/sources/${created.sourceRecordId}/proposals/${reproposed.proposal.id}/decision`,
			{
				mappingVersion: OpenLibraryMappingVersion,
				action: "apply",
				reason: "Apply the exact observed Open Library title",
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(applied.status, "applied");
	assertions++;
	const appliedPrimary = await primaryName(created.reference, owner.cookie, revisedTitle);
	const nameHistory = await database
		.select({
			revision: CatalogNameTables.publishing.nameRevision.revision,
			value: CatalogNameTables.publishing.nameRevision.value,
		})
		.from(CatalogNameTables.publishing.nameRevision)
		.where(
			and(
				eq(CatalogNameTables.publishing.nameRevision.ownerId, created.reference.id),
				eq(CatalogNameTables.publishing.nameRevision.id, appliedPrimary.id),
			),
		)
		.orderBy(CatalogNameTables.publishing.nameRevision.revision);
	assert.ok(nameHistory.some((row) => row.value === originalTitle));
	assert.ok(nameHistory.some((row) => row.value === revisedTitle));
	assertions += 2;
	assert.ok((await listedNames(created.reference, owner.cookie)).items.some((item) => item.id === extra.id));
	assertions++;

	const withdrawn = CatalogSourceDecisionResultSchema.parse(
		await request(
			"POST",
			`/catalog/sources/${created.sourceRecordId}/proposals/${reproposed.proposal.id}/decision`,
			{
				mappingVersion: OpenLibraryMappingVersion,
				action: "withdraw",
				reason: "Restore the previous exact source snapshot",
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(withdrawn.status, "withdrawn");
	assertions++;
	const restoredPrimary = await primaryName(created.reference, owner.cookie, originalTitle);
	const restoredHistory = await database
		.select({
			revision: CatalogNameTables.publishing.nameRevision.revision,
			value: CatalogNameTables.publishing.nameRevision.value,
		})
		.from(CatalogNameTables.publishing.nameRevision)
		.where(
			and(
				eq(CatalogNameTables.publishing.nameRevision.ownerId, created.reference.id),
				eq(CatalogNameTables.publishing.nameRevision.id, restoredPrimary.id),
			),
		)
		.orderBy(CatalogNameTables.publishing.nameRevision.revision);
	assert.ok(restoredHistory.length >= 3);
	assert.equal(restoredHistory.at(-1)?.value, originalTitle);
	assert.ok(restoredHistory.some((row) => row.value === revisedTitle));
	assertions += 3;
	const [head] = await database
		.select({ headSnapshotId: catalogSourceRecord.headSnapshotId })
		.from(catalogSourceRecord)
		.where(eq(catalogSourceRecord.id, created.sourceRecordId))
		.limit(1);
	assert.equal(head?.headSnapshotId, refreshed.snapshotId);
	assertions++;

	const local = CatalogNamedFormSchema.parse(
		await request(
			"PUT",
			`${resourcePath(created.reference)}/names/${restoredPrimary.id}`,
			{
				expectedRevision: restoredPrimary.revision,
				value: { ...nameInput(restoredPrimary), value: "Locally edited fixture title" },
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(local.value, "Locally edited fixture title");
	assertions++;
	const conflictProposal = CatalogSourceProposeResultSchema.parse(
		await request(
			"POST",
			`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}/proposals`,
			{ snapshotId: refreshed.snapshotId, mappingVersion: OpenLibraryMappingVersion },
			200,
			owner.cookie,
		),
	);
	assert.equal(conflictProposal.status, "proposed");
	assert.ok(conflictProposal.proposal);
	assertions += 2;
	await denied(
		"POST",
		`/catalog/sources/${created.sourceRecordId}/proposals/${conflictProposal.proposal.id}/decision`,
		{
			mappingVersion: OpenLibraryMappingVersion,
			action: "apply",
			reason: "Local named-form edit must not be overwritten",
		},
		409,
		"CatalogRevisionConflict",
		owner.cookie,
	);
	assert.equal(
		(await primaryName(created.reference, owner.cookie, "Locally edited fixture title")).id,
		local.id,
	);

	const currentBindings = CatalogResourceBindingsPageSchema.parse(
		await request("GET", `${resourcePath(created.reference)}/source-bindings`, undefined, 200, owner.cookie),
	);
	const currentBinding = currentBindings.items[0];
	assert.ok(currentBinding);
	assertions++;
	const paused = CatalogSourceBindingMutationSchema.parse(
		await request(
			"PATCH",
			`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}`,
			{
				expectedRevision: currentBinding.bindingRevision,
				state: "paused",
				mode: "review",
				reason: "Pause exact source correspondence",
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(paused.state, "paused");
	assertions++;
	await denied(
		"PATCH",
		`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}`,
		{
			expectedRevision: currentBinding.bindingRevision,
			state: "active",
			mode: "review",
			reason: "Stale binding revision must not resume",
		},
		409,
		"CatalogRevisionConflict",
		owner.cookie,
	);
	const resumed = CatalogSourceBindingMutationSchema.parse(
		await request(
			"PATCH",
			`/catalog/sources/${created.sourceRecordId}/bindings/${created.mappingKey}`,
			{
				expectedRevision: paused.revision,
				state: "active",
				mode: "review",
				reason: "Resume exact source correspondence",
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(resumed.state, "active");
	assertions++;
	const afterResume = CatalogResourceBindingsPageSchema.parse(
		await request("GET", `${resourcePath(created.reference)}/source-bindings`, undefined, 200, owner.cookie),
	);
	assert.equal(afterResume.items[0]?.state, "active");
	assert.equal(afterResume.items[0]?.mode, "review");
	assertions += 2;

	await waitOpenLibraryBudget();
	const edition = nativeIntake(
		await request(
			"POST",
			"/catalog/sources/intake",
			{ source: "openlibrary", objectType: "edition", externalId: editionKey },
			200,
			owner.cookie,
		),
	);
	assert.equal(edition.status, "created");
	assertions++;
	await assertPersisted(edition, {
		source: "openlibrary",
		objectType: "edition",
		externalId: editionKey,
	});
	const editionMetadata = CatalogResourceSchema.parse(
		await request("GET", resourcePath(edition.reference), undefined, 200, owner.cookie),
	);
	assert.equal(editionMetadata.shape, "publication");
	assert.equal(editionMetadata.visibility, "private");
	assert.notEqual(edition.reference.id, created.reference.id);
	assertions += 3;
	await primaryName(edition.reference, owner.cookie, editionTitle);

	console.log(
		JSON.stringify({
			check: "catalog-source-api",
			assertions,
			workKey,
			editionKey,
			upstreamCalls,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
