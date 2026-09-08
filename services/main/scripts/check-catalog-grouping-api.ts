import assert from "node:assert/strict";
import Elysia from "elysia";
import { inArray } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { z } from "zod";
import type { CatalogReference } from "@rezics/reference";
import type { DatabaseTransaction } from "../src/services/database";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	CatalogCreatedSchema,
	CatalogMutationSchema,
	CatalogResourceSchema,
} from "../src/services/catalog/resource-contracts";
import {
	CatalogSemanticCreatedSchema,
	CatalogSemanticHistorySchema,
	CatalogSemanticMutationSchema,
	WriteCatalogRelationSchema,
} from "../src/services/catalog/semantic-api-contracts";
import {
	GroupingClassSchema,
	GroupingHistorySchema,
	GroupingMutationSchema,
	GroupingOrderCreatedSchema,
	GroupingOrderEntrySchema,
	GroupingOrderProfileSchema,
	groupingPage,
} from "../src/services/catalog/grouping-api-contracts";
import {
	InitialFractionalPosition,
	fractionalPositionBetween,
} from "../src/services/ordering/position";

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
		name: "rezics-catalog-grouping-api-fixture",
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
const { default: errors } = await import("../src/services/api/error-boundary");

const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog);
api.compile();
const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;

const CatalogApiErrorBodySchema = z.strictObject({
	error: z.strictObject({
		code: z.enum([
			"AuthenticationRequired",
			"ValidationError",
			"CatalogReferenceNotFound",
			"CatalogRevisionConflict",
			"ParticipationDenied",
		]),
		message: z.string(),
		details: z.unknown().optional(),
	}),
	requestId: z.string().min(1),
});
const classesPage = groupingPage(GroupingClassSchema);
const ordersPage = groupingPage(GroupingOrderProfileSchema);
const entriesPage = groupingPage(GroupingOrderEntrySchema);
const historyPage = groupingPage(GroupingHistorySchema);
const name = (value: string) => ({ languageTag: "en" as const, value });
const missingGroupingId = crypto.randomUUID();
const missingClassRevisionId = crypto.randomUUID();
const missingProfileId = crypto.randomUUID();
const missingRelationId = crypto.randomUUID();
const missingHistoricalRevision = 9001;

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

async function exchange(method: string, path: string, body: unknown, cookie?: string) {
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
	assert.equal(text.includes("createdByAuthUserId"), false, `${method} ${path} leaked createdByAuthUserId`);
	assert.equal(text.includes("AuthUserId"), false, `${method} ${path} leaked AuthUserId`);
	assertions += 2;
	return { status: response.status, text, value: text ? (JSON.parse(text) as unknown) : null };
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
	assert.equal(value.error.code, code, `${method} ${path} code ${value.error.code}: ${value.error.message}`);
	assertions++;
	return value;
}

async function currentParticipation<T>(cookie: string, work: (tx: DatabaseTransaction) => Promise<T>) {
	const identity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: cookie } }),
		"account:read",
	);
	if (!("participation" in identity))
		throw new Error("Fixture definitions require explicit participation");
	return runWithParticipationAuthority(identity.participation, () =>
		database.transaction(async (tx) => {
			await requireParticipation(tx, identity.participation, "entity.security", {
				owner: "entity",
				id: identity.participation.actingEntityId,
			});
			return work(tx);
		}),
	);
}

async function createResource(body: unknown, cookie: string) {
	return CatalogCreatedSchema.parse(await request("POST", "/catalog/resources", body, 200, cookie));
}

function resourcePath(reference: CatalogReference) {
	return `/catalog/resources/${reference.owner}/${reference.id}`;
}

function groupingPath(id: string) {
	return `/catalog/grouping/${id}`;
}

async function current(reference: CatalogReference, cookie: string) {
	return CatalogResourceSchema.parse(await request("GET", resourcePath(reference), undefined, 200, cookie));
}

async function publishPublic(reference: CatalogReference, cookie: string) {
	const metadata = await current(reference, cookie);
	CatalogMutationSchema.parse(
		await request(
			"PATCH",
			`${resourcePath(reference)}/lifecycle`,
			{
				expectedRevision: metadata.revision,
				status: "published",
				visibility: "public",
				contentRating: metadata.contentRating,
			},
			200,
			cookie,
		),
	);
}

async function writeMembership(
	grouping: CatalogReference,
	cookie: string,
	definitionRevisionId: string,
	roleRevisionId: string,
	target: CatalogReference,
	spoiler: 0 | 1 | 2 = 0,
) {
	const metadata = await current(grouping, cookie);
	return CatalogSemanticCreatedSchema.parse(
		await request(
			"POST",
			`${resourcePath(grouping)}/relations`,
			WriteCatalogRelationSchema.parse({
				expectedRevision: metadata.revision,
				definitionRevisionId,
				spoiler,
				participants: [{ roleRevisionId, target }],
			}),
			200,
			cookie,
		),
	);
}

try {
	const owner = await actor("Grouping API fixture owner");
	const stranger = await actor("Grouping API fixture stranger");
	const grouping = await createResource({ kind: "grouping", name: name("Grouping API series") }, owner);
	const otherGrouping = await createResource(
		{ kind: "grouping", name: name("Grouping API independent series") },
		owner,
	);
	const publicMember = await createResource(
		{ kind: "entity", shape: "person", name: name("Grouping public member") },
		owner,
	);
	const publicMember2 = await createResource(
		{ kind: "entity", shape: "person", name: name("Grouping public member two") },
		owner,
	);
	const privateMember = await createResource(
		{ kind: "entity", shape: "person", name: name("Grouping private member") },
		owner,
	);
	const spoilerMember = await createResource(
		{ kind: "entity", shape: "person", name: name("Grouping spoiler member") },
		owner,
	);
	const withdrawnMember = await createResource(
		{ kind: "entity", shape: "person", name: name("Grouping withdrawn member") },
		owner,
	);
	assert.equal(grouping.reference.owner, "grouping");
	assertions++;
	await publishPublic(grouping.reference, owner);
	await publishPublic(otherGrouping.reference, owner);
	await publishPublic(publicMember.reference, owner);
	await publishPublic(publicMember2.reference, owner);
	await publishPublic(spoilerMember.reference, owner);
	await publishPublic(withdrawnMember.reference, owner);

	const namespace = `fixture.grouping.${crypto.randomUUID()}`;
	const meanings = await currentParticipation(owner, async (tx) => {
		const cls = await ensureCatalogDefinition(tx, {
			namespace,
			key: "series",
			kind: "class",
			valueKind: null,
		});
		const property = await ensureCatalogDefinition(tx, {
			namespace,
			key: "text",
			kind: "property",
			valueKind: "string",
		});
		const role = await ensureCatalogDefinition(tx, {
			namespace,
			key: "member",
			kind: "role",
			valueKind: null,
		});
		const predicate = await ensureCatalogDefinition(tx, {
			namespace,
			key: "membership",
			kind: "predicate",
			valueKind: null,
			constraints: {
				targets: [{ owner: "grouping", shapes: ["grouping"] }],
				roles: [
					{
						roleRevisionId: role.revisionId,
						min: 1,
						max: 1,
						targets: [{ owner: "entity", shapes: ["person"] }],
					},
				],
			},
		});
		return { cls, property, role, predicate };
	});

	await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/classes/${meanings.cls.revisionId}`,
		{ expectedRevision: (await current(grouping.reference, owner)).revision },
		401,
		"AuthenticationRequired",
	);
	await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/classes/${meanings.cls.revisionId}`,
		{ expectedRevision: (await current(grouping.reference, owner)).revision },
		403,
		"ParticipationDenied",
		stranger,
	);
	await denied(
		"GET",
		`${groupingPath(missingGroupingId)}/classes`,
		undefined,
		404,
		"CatalogReferenceNotFound",
		owner,
	);
	await denied(
		"PUT",
		`${groupingPath(missingGroupingId)}/classes/${meanings.cls.revisionId}`,
		{ expectedRevision: 1 },
		404,
		"CatalogReferenceNotFound",
		owner,
	);

	const assigned = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/classes/${meanings.cls.revisionId}`,
			{ expectedRevision: (await current(grouping.reference, owner)).revision },
			200,
			owner,
		),
	);
	const listedClasses = classesPage.parse(
		await request("GET", `${groupingPath(grouping.reference.id)}/classes`, undefined, 200, owner),
	);
	assert.deepEqual(
		listedClasses.items.map((row) => row.classRevisionId),
		[meanings.cls.revisionId],
	);
	assertions++;
	const incompatibleClass = await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/classes/${meanings.property.revisionId}`,
		{ expectedRevision: (await current(grouping.reference, owner)).revision },
		422,
		"ValidationError",
		owner,
	);
	assert.equal(
		JSON.stringify(incompatibleClass.error.details),
		JSON.stringify({ message: "Profile classification has an incompatible definition kind" }),
		`incompatible class details: ${JSON.stringify(incompatibleClass.error.details)}`,
	);
	assertions++;
	await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/classes/${missingClassRevisionId}`,
		{ expectedRevision: (await current(grouping.reference, owner)).revision },
		422,
		"ValidationError",
		owner,
	);
	const removedClass = GroupingMutationSchema.parse(
		await request(
			"DELETE",
			`${groupingPath(grouping.reference.id)}/classes/${meanings.cls.revisionId}`,
			{ expectedRevision: (await current(grouping.reference, owner)).revision },
			200,
			owner,
		),
	);
	assert.equal(
		classesPage.parse(
			await request("GET", `${groupingPath(grouping.reference.id)}/classes`, undefined, 200, owner),
		).items.length,
		0,
	);
	assertions++;
	GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/classes/${meanings.cls.revisionId}`,
			{ expectedRevision: removedClass.revision },
			200,
			owner,
		),
	);

	const withdrawnRelation = await writeMembership(
		grouping.reference,
		owner,
		meanings.predicate.revisionId,
		meanings.role.revisionId,
		withdrawnMember.reference,
	);
	const privateRelation = await writeMembership(
		grouping.reference,
		owner,
		meanings.predicate.revisionId,
		meanings.role.revisionId,
		privateMember.reference,
	);
	const spoilerRelation = await writeMembership(
		grouping.reference,
		owner,
		meanings.predicate.revisionId,
		meanings.role.revisionId,
		spoilerMember.reference,
		2,
	);
	const publicRelation = await writeMembership(
		grouping.reference,
		owner,
		meanings.predicate.revisionId,
		meanings.role.revisionId,
		publicMember.reference,
	);
	const publicRelation2 = await writeMembership(
		grouping.reference,
		owner,
		meanings.predicate.revisionId,
		meanings.role.revisionId,
		publicMember2.reference,
	);

	const publication = GroupingOrderCreatedSchema.parse(
		await request(
			"POST",
			`${groupingPath(grouping.reference.id)}/orders`,
			{ expectedRevision: (await current(grouping.reference, owner)).revision, key: "publication" },
			200,
			owner,
		),
	);
	const chronology = GroupingOrderCreatedSchema.parse(
		await request(
			"POST",
			`${groupingPath(grouping.reference.id)}/orders`,
			{ expectedRevision: publication.revision, key: "chronology" },
			200,
			owner,
		),
	);
	assert.notEqual(publication.id, chronology.id);
	assertions++;
	const listedOrders = ordersPage.parse(
		await request("GET", `${groupingPath(grouping.reference.id)}/orders`, undefined, 200, owner),
	);
	assert.equal(listedOrders.items.length, 2);
	assertions++;
	assert.deepEqual(
		new Set(listedOrders.items.map((row) => row.key)),
		new Set(["publication", "chronology"]),
	);
	assertions++;

	const renamed = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}`,
			{ expectedRevision: chronology.revision, key: "release-order" },
			200,
			owner,
		),
	);
	assert.equal(
		ordersPage
			.parse(await request("GET", `${groupingPath(grouping.reference.id)}/orders`, undefined, 200, owner))
			.items.find((row) => row.id === publication.id)?.key,
		"release-order",
	);
	assertions++;
	const restoredName = GroupingMutationSchema.parse(
		await request(
			"POST",
			`${groupingPath(grouping.reference.id)}/history/restore`,
			{ expectedRevision: renamed.revision, historicalRevision: publication.revision },
			200,
			owner,
		),
	);
	assert.equal(
		ordersPage
			.parse(await request("GET", `${groupingPath(grouping.reference.id)}/orders`, undefined, 200, owner))
			.items.find((row) => row.id === publication.id)?.key,
		"publication",
	);
	assertions++;

	const p0 = InitialFractionalPosition;
	const p1 = fractionalPositionBetween(p0, null);
	const p2 = fractionalPositionBetween(p1, null);
	const p3 = fractionalPositionBetween(p2, null);
	const orderedWithdrawn = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${withdrawnRelation.id}`,
			{ expectedRevision: restoredName.revision, position: p0, sourcePosition: "w0" },
			200,
			owner,
		),
	);
	const orderedPrivate = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${privateRelation.id}`,
			{ expectedRevision: orderedWithdrawn.revision, position: p1, sourcePosition: "private" },
			200,
			owner,
		),
	);
	const spoilerOrderDenied = await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${spoilerRelation.id}`,
		{ expectedRevision: orderedPrivate.revision, position: p2, sourcePosition: "spoiler" },
		404,
		"CatalogReferenceNotFound",
		owner,
	);
	assert.equal(spoilerOrderDenied.error.message, "Only an active readable membership can be ordered");
	assertions++;
	assert.equal((await current(grouping.reference, owner)).revision, orderedPrivate.revision);
	assertions++;
	const orderedPublic = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${publicRelation.id}`,
			{ expectedRevision: orderedPrivate.revision, position: p2, sourcePosition: "1.5" },
			200,
			owner,
		),
	);
	const orderedPublic2 = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${publicRelation2.id}`,
			{ expectedRevision: orderedPublic.revision, position: p3 },
			200,
			owner,
		),
	);
	GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${chronology.id}/entries/${publicRelation.id}`,
			{ expectedRevision: orderedPublic2.revision, position: p0, sourcePosition: "c-public" },
			200,
			owner,
		),
	);
	const chronologySet = GroupingMutationSchema.parse(
		await request(
			"PUT",
			`${groupingPath(grouping.reference.id)}/orders/${chronology.id}/entries/${publicRelation2.id}`,
			{
				expectedRevision: (await current(grouping.reference, owner)).revision,
				position: p1,
				sourcePosition: "c-public-2",
			},
			200,
			owner,
		),
	);
	CatalogSemanticMutationSchema.parse(
		await request(
			"POST",
			`${resourcePath(grouping.reference)}/semantics/${withdrawnRelation.semanticId}/state`,
			{
				expectedRevision: chronologySet.revision,
				expectedHeadVersion: withdrawnRelation.headVersion,
				state: "withdrawn",
			},
			200,
			owner,
		),
	);

	const ownerPublication = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?maxSpoiler=2`,
			undefined,
			200,
			owner,
		),
	);
	assert.deepEqual(
		ownerPublication.items.map((row) => [row.relationId, row.position, row.sourcePosition]),
		[
			[privateRelation.id, p1, "private"],
			[publicRelation.id, p2, "1.5"],
			[publicRelation2.id, p3, null],
		],
	);
	assertions++;
	assert.equal(
		ownerPublication.items.some((row) => row.relationId === withdrawnRelation.id),
		false,
	);
	assertions++;

	const chronologyEntries = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${chronology.id}/entries`,
			undefined,
			200,
			owner,
		),
	);
	assert.deepEqual(
		chronologyEntries.items.map((row) => row.relationId),
		[publicRelation.id, publicRelation2.id],
	);
	assertions++;

	const staleBefore = await current(grouping.reference, owner);
	const staleEntries = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?maxSpoiler=2`,
			undefined,
			200,
			owner,
		),
	);
	const staleConflict = await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${publicRelation.id}`,
		{ expectedRevision: staleBefore.revision - 1, position: p0, sourcePosition: "stale" },
		409,
		"CatalogRevisionConflict",
		owner,
	);
	assert.equal(staleConflict.error.message, "Catalog revision changed");
	assertions++;
	assert.equal((await current(grouping.reference, owner)).revision, staleBefore.revision);
	assertions++;
	assert.deepEqual(
		entriesPage.parse(
			await request(
				"GET",
				`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?maxSpoiler=2`,
				undefined,
				200,
				owner,
			),
		).items,
		staleEntries.items,
	);
	assertions++;

	const missingRelation = await denied(
		"PUT",
		`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${missingRelationId}`,
		{ expectedRevision: (await current(grouping.reference, owner)).revision, position: p0 },
		404,
		"CatalogReferenceNotFound",
		owner,
	);
	assert.equal(missingRelation.error.message, "Only an active readable membership can be ordered");
	assertions++;
	assert.deepEqual(
		entriesPage.parse(
			await request(
				"GET",
				`${groupingPath(grouping.reference.id)}/orders/${missingProfileId}/entries`,
				undefined,
				200,
				owner,
			),
		).items,
		[],
	);
	assertions++;

	const anonymousFirst = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?limit=1&maxSpoiler=0`,
			undefined,
			200,
		),
	);
	assert.deepEqual(anonymousFirst.items, []);
	assertions++;
	assert.equal(typeof anonymousFirst.nextCursor, "string");
	assertions++;
	assert.ok(anonymousFirst.nextCursor);
	const anonymousSecond = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?limit=1&maxSpoiler=0&cursor=${anonymousFirst.nextCursor}`,
			undefined,
			200,
		),
	);
	assert.deepEqual(anonymousSecond.items, []);
	assertions++;
	assert.ok(anonymousSecond.nextCursor);
	const anonymousThird = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?limit=1&maxSpoiler=0&cursor=${anonymousSecond.nextCursor}`,
			undefined,
			200,
		),
	);
	assert.deepEqual(
		anonymousThird.items.map((row) => [row.relationId, row.sourcePosition]),
		[[publicRelation.id, "1.5"]],
	);
	assertions++;
	assert.ok(anonymousThird.nextCursor);

	const spoilerMismatch = await denied(
		"GET",
		`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?limit=1&maxSpoiler=1&cursor=${anonymousFirst.nextCursor}`,
		undefined,
		422,
		"ValidationError",
	);
	assert.equal(
		JSON.stringify(spoilerMismatch.error.details),
		JSON.stringify({ message: "Catalog cursor belongs to another collection" }),
		`spoiler cursor details: ${JSON.stringify(spoilerMismatch.error.details)}`,
	);
	assertions++;
	const profileMismatch = await denied(
		"GET",
		`${groupingPath(grouping.reference.id)}/orders/${chronology.id}/entries?limit=1&maxSpoiler=0&cursor=${anonymousFirst.nextCursor}`,
		undefined,
		422,
		"ValidationError",
	);
	assert.equal(
		JSON.stringify(profileMismatch.error.details),
		JSON.stringify({ message: "Catalog cursor belongs to another collection" }),
		`profile cursor details: ${JSON.stringify(profileMismatch.error.details)}`,
	);
	assertions++;
	const ownerMismatch = await denied(
		"GET",
		`${groupingPath(otherGrouping.reference.id)}/orders/${publication.id}/entries?limit=1&maxSpoiler=0&cursor=${anonymousFirst.nextCursor}`,
		undefined,
		422,
		"ValidationError",
	);
	assert.equal(
		JSON.stringify(ownerMismatch.error.details),
		JSON.stringify({ message: "Catalog cursor belongs to another collection" }),
		`owner cursor details: ${JSON.stringify(ownerMismatch.error.details)}`,
	);
	assertions++;

	const relationHistory = CatalogSemanticHistorySchema.parse(
		await request(
			"GET",
			`${resourcePath(grouping.reference)}/semantics/${publicRelation.semanticId}/history`,
			undefined,
			200,
			owner,
		),
	);
	assert.ok(relationHistory.items.some((row) => row.relationId === publicRelation.id && row.state === "active"));
	assertions++;

	const anonymousHistory = await denied(
		"GET",
		`${groupingPath(grouping.reference.id)}/history`,
		undefined,
		404,
		"CatalogReferenceNotFound",
	);
	assert.equal(anonymousHistory.error.code, "CatalogReferenceNotFound");
	assertions++;
	await denied(
		"GET",
		`${groupingPath(grouping.reference.id)}/history`,
		undefined,
		404,
		"CatalogReferenceNotFound",
		stranger,
	);
	await denied(
		"POST",
		`${groupingPath(grouping.reference.id)}/history/restore`,
		{ expectedRevision: (await current(grouping.reference, owner)).revision, historicalRevision: assigned.revision },
		401,
		"AuthenticationRequired",
	);

	const commands = historyPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/history?limit=100`,
			undefined,
			200,
			owner,
		),
	);
	assert.ok(commands.items.some((row) => row.snapshot.operation === "order.rename"));
	assertions++;
	assert.ok(commands.items.some((row) => row.snapshot.operation === "order.set"));
	assertions++;

	const removedPublic = GroupingMutationSchema.parse(
		await request(
			"DELETE",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries/${publicRelation.id}`,
			{ expectedRevision: (await current(grouping.reference, owner)).revision },
			200,
			owner,
		),
	);
	assert.equal(
		entriesPage
			.parse(
				await request(
					"GET",
					`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?maxSpoiler=2`,
					undefined,
					200,
					owner,
				),
			)
			.items.some((row) => row.relationId === publicRelation.id),
		false,
	);
	assertions++;
	const stillListed = CatalogSemanticHistorySchema.parse(
		await request(
			"GET",
			`${resourcePath(grouping.reference)}/semantics/${publicRelation.semanticId}/history`,
			undefined,
			200,
			owner,
		),
	);
	assert.ok(stillListed.items.some((row) => row.relationId === publicRelation.id));
	assertions++;
	const restoredEntry = GroupingMutationSchema.parse(
		await request(
			"POST",
			`${groupingPath(grouping.reference.id)}/history/restore`,
			{ expectedRevision: removedPublic.revision, historicalRevision: orderedPublic.revision },
			200,
			owner,
		),
	);
	const restoredEntries = entriesPage.parse(
		await request(
			"GET",
			`${groupingPath(grouping.reference.id)}/orders/${publication.id}/entries?maxSpoiler=2`,
			undefined,
			200,
			owner,
		),
	);
	assert.deepEqual(
		restoredEntries.items.find((row) => row.relationId === publicRelation.id),
		{ relationId: publicRelation.id, position: p2, sourcePosition: "1.5" },
	);
	assertions++;
	assert.ok(restoredEntry.revision > removedPublic.revision);
	assertions++;

	await denied(
		"POST",
		`${groupingPath(grouping.reference.id)}/history/restore`,
		{
			expectedRevision: (await current(grouping.reference, owner)).revision,
			historicalRevision: missingHistoricalRevision,
		},
		404,
		"CatalogReferenceNotFound",
		owner,
	);

	console.log(
		JSON.stringify({
			check: "catalog-grouping-api",
			assertions,
			groupingId: grouping.reference.id,
			otherGroupingId: otherGrouping.reference.id,
			publicationProfileId: publication.id,
			chronologyProfileId: chronology.id,
			missingGroupingId,
			missingClassRevisionId,
			missingProfileId,
			missingRelationId,
			missingHistoricalRevision,
			withdrawnRelationId: withdrawnRelation.id,
			privateRelationId: privateRelation.id,
			spoilerRelationId: spoilerRelation.id,
			publicRelationId: publicRelation.id,
			anonymousEmptyPageNextCursor: Boolean(anonymousFirst.nextCursor),
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
