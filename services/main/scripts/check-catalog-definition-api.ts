import assert from "node:assert/strict";
import Elysia from "elysia";
import { eq, inArray } from "drizzle-orm";
import type { PoolClient } from "pg";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
import { platformCapabilityGrant } from "@rezics/schema/postgres/realms/realm";
import { catalogDefinitionRevision } from "@rezics/schema/postgres/catalog/identity";
import { catalogDefinitionLabel, catalogDefinitionReview } from "@rezics/schema/postgres/knowledge/definition-governance";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	CatalogDefinitionPageSchema,
	CatalogDefinitionSchema,
	CatalogDefinitionRevisionSchema,
	CatalogDefinitionHistorySchema,
} from "../src/services/catalog/definition-api-contracts";

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
		name: "rezics-catalog-definition-api-fixture",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: errors } = await import("../src/services/api/error-boundary");

const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog);
api.compile();
const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
const privateReason = `private-review-${crypto.randomUUID()}`;
const leakKeys = ['"authUserId"', '"grantId"', '"reason"', '"createdByAuthUserId"', privateReason];

async function actor() {
	const account = await database.transaction(async (tx) => {
		const [row] = await tx
			.insert(users)
			.values({
				name: "Native definition API fixture",
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
	return { id: account.id, cookie };
}

function assertPrivate(text: string) {
	for (const leak of leakKeys) {
		assert.equal(text.includes(leak), false, `response leaked ${leak}`);
		assertions++;
	}
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
	assertPrivate(text);
	return text ? (JSON.parse(text) as unknown) : null;
}

const stringConstraints = { nullable: false, integer: false, minLength: 1, maxLength: 64 };
const revisedConstraints = { nullable: false, integer: false, minLength: 1, maxLength: 32 };
const emptyConstraints = { nullable: false, integer: false };
const english = (label: string) => [{ languageTag: "en", label, description: null }];

function propertyBody(namespace: string, key: string, constraints = stringConstraints) {
	return {
		namespace,
		key,
		kind: "property" as const,
		valueKind: "string" as const,
		constraints,
		labels: english(`Property ${key}`),
		reason: privateReason,
	};
}

function roleBody(namespace: string, key: string) {
	return {
		namespace,
		key,
		kind: "role" as const,
		valueKind: null,
		constraints: emptyConstraints,
		labels: english(`Role ${key}`),
		reason: privateReason,
	};
}

function predicateBody(namespace: string, key: string, roleRevisionId: string) {
	return {
		namespace,
		key,
		kind: "predicate" as const,
		valueKind: null,
		constraints: {
			...emptyConstraints,
			roles: [
				{
					roleRevisionId,
					min: 1,
					max: 1,
					targets: [{ owner: "entity" as const, shapes: ["person"] }],
				},
			],
		},
		labels: english(`Predicate ${key}`),
		reason: privateReason,
	};
}

async function rejectedSql(
	client: PoolClient,
	query: string,
	params: unknown[],
	codes: readonly string[],
) {
	await client.query("savepoint expected_rejection");
	try {
		await client.query(query, params);
		throw new Error(`Expected SQL rejection: ${query}`);
	} catch (error) {
		const code =
			typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
		assert.ok(codes.includes(code), `${query} rejected with ${code}`);
		assertions++;
	} finally {
		await client.query("rollback to savepoint expected_rejection");
	}
}

try {
	const admin = await actor();
	const ordinary = await actor();
	const namespace = `fixture.definition.${crypto.randomUUID()}`;

	const anonymousList = CatalogDefinitionPageSchema.parse(
		await request("GET", "/catalog/definitions?limit=1", undefined, 200),
	);
	assert.ok(Array.isArray(anonymousList.items));
	assertions++;
	assert.deepEqual(
		await request("GET", "/catalog/definitions/permissions", undefined, 200),
		{ canManage: false },
	);
	assertions++;
	await request("POST", "/catalog/definitions", propertyBody(namespace, "anon"), 401);
	assert.deepEqual(
		await request("GET", "/catalog/definitions/permissions", undefined, 200, ordinary.cookie),
		{ canManage: false },
	);
	assertions++;
	await request("POST", "/catalog/definitions", propertyBody(namespace, "ordinary"), 403, ordinary.cookie);

	const [grant] = await database
		.insert(platformCapabilityGrant)
		.values({
			authUserId: admin.id,
			capability: "catalog.definition.manage",
			grantedByAuthUserId: admin.id,
		})
		.returning({ id: platformCapabilityGrant.id });
	assert.ok(grant);
	assert.deepEqual(
		await request("GET", "/catalog/definitions/permissions", undefined, 200, admin.cookie),
		{ canManage: true },
	);
	assertions++;

	const attrA = CatalogDefinitionRevisionSchema.parse(
		await request("POST", "/catalog/definitions", propertyBody(namespace, "attr_a"), 200, admin.cookie),
	);
	assert.equal(attrA.version, 1);
	assert.equal(attrA.reviewed, true);
	assert.equal(attrA.valueKind, "string");
	assert.equal(attrA.constraints.maxLength, 64);
	assertions += 4;
	const attrB = CatalogDefinitionRevisionSchema.parse(
		await request("POST", "/catalog/definitions", propertyBody(namespace, "attr_b"), 200, admin.cookie),
	);
	const role = CatalogDefinitionRevisionSchema.parse(
		await request("POST", "/catalog/definitions", roleBody(namespace, "subject"), 200, admin.cookie),
	);
	assert.equal(role.valueKind, null);
	assertions++;
	const predicate = CatalogDefinitionRevisionSchema.parse(
		await request(
			"POST",
			"/catalog/definitions",
			predicateBody(namespace, "qualified_contribution", role.id),
			200,
			admin.cookie,
		),
	);
	assert.equal(predicate.constraints.roles?.[0]?.roleRevisionId, role.id);
	assertions++;

	await request(
		"POST",
		"/catalog/definitions",
		predicateBody(namespace, "invalid_role_kind", attrA.id),
		422,
		admin.cookie,
	);
	await request("POST", "/catalog/definitions", propertyBody(namespace, "attr_a"), 409, admin.cookie);

	const firstPage = CatalogDefinitionPageSchema.parse(
		await request(
			"GET",
			`/catalog/definitions?namespace=${namespace}&kind=property&limit=1`,
			undefined,
			200,
		),
	);
	assert.equal(firstPage.items.length, 1);
	assert.equal(firstPage.items[0]?.key, "attr_a");
	assert.ok(firstPage.after);
	assertions += 3;
	const secondPage = CatalogDefinitionPageSchema.parse(
		await request(
			"GET",
			`/catalog/definitions?namespace=${namespace}&kind=property&limit=1&afterNamespace=${firstPage.after!.afterNamespace}&afterKey=${firstPage.after!.afterKey}`,
			undefined,
			200,
		),
	);
	assert.equal(secondPage.items[0]?.key, "attr_b");
	assertions++;

	const identity = CatalogDefinitionSchema.parse(
		await request("GET", `/catalog/definitions/${attrA.definitionId}`, undefined, 200),
	);
	assert.equal(identity.current?.id, attrA.id);
	assertions++;
	const exact = CatalogDefinitionRevisionSchema.parse(
		await request("GET", `/catalog/definitions/revisions/${attrA.id}`, undefined, 200),
	);
	assert.deepEqual(exact.constraints, attrA.constraints);
	assertions++;

	await request(
		"POST",
		`/catalog/definitions/${attrA.definitionId}/revisions`,
		{
			expectedVersion: 99,
			valueKind: "string",
			constraints: revisedConstraints,
			labels: english("Stale"),
			reason: privateReason,
		},
		409,
		admin.cookie,
	);
	const v2 = CatalogDefinitionRevisionSchema.parse(
		await request(
			"POST",
			`/catalog/definitions/${attrA.definitionId}/revisions`,
			{
				expectedVersion: 1,
				valueKind: "string",
				constraints: revisedConstraints,
				labels: english("Property attr_a v2"),
				reason: privateReason,
			},
			200,
			admin.cookie,
		),
	);
	assert.equal(v2.version, 2);
	assert.equal(v2.constraints.maxLength, 32);
	assertions += 2;
	const stillV1 = CatalogDefinitionRevisionSchema.parse(
		await request("GET", `/catalog/definitions/revisions/${attrA.id}`, undefined, 200),
	);
	assert.equal(stillV1.version, 1);
	assert.equal(stillV1.constraints.maxLength, 64);
	assert.notEqual(stillV1.id, v2.id);
	assertions += 3;
	const current = CatalogDefinitionSchema.parse(
		await request("GET", `/catalog/definitions/${attrA.definitionId}`, undefined, 200),
	);
	assert.equal(current.current?.id, v2.id);
	assertions++;
	const historyHead = CatalogDefinitionHistorySchema.parse(
		await request(
			"GET",
			`/catalog/definitions/${attrA.definitionId}/revisions?limit=1`,
			undefined,
			200,
		),
	);
	assert.equal(historyHead.items[0]?.id, v2.id);
	assert.ok(historyHead.afterVersion);
	assertions += 2;
	const historyTail = CatalogDefinitionHistorySchema.parse(
		await request(
			"GET",
			`/catalog/definitions/${attrA.definitionId}/revisions?limit=1&afterVersion=${historyHead.afterVersion}`,
			undefined,
			200,
		),
	);
	assert.equal(historyTail.items[0]?.id, attrA.id);
	assertions++;

	const [label] = await database
		.select({ languageTag: catalogDefinitionLabel.languageTag })
		.from(catalogDefinitionLabel)
		.where(eq(catalogDefinitionLabel.definitionRevisionId, attrA.id))
		.limit(1);
	const [review] = await database
		.select({ definitionRevisionId: catalogDefinitionReview.definitionRevisionId })
		.from(catalogDefinitionReview)
		.where(eq(catalogDefinitionReview.definitionRevisionId, attrA.id))
		.limit(1);
	const [revision] = await database
		.select({ id: catalogDefinitionRevision.id })
		.from(catalogDefinitionRevision)
		.where(eq(catalogDefinitionRevision.id, attrA.id))
		.limit(1);
	assert.ok(label && review && revision);

	const client = await database.$client.connect();
	try {
		await client.query("begin");
		await rejectedSql(
			client,
			"update catalog_definition_revision set constraints = constraints || '{\"nullable\":true}'::jsonb where id = $1",
			[attrA.id],
			["23514"],
		);
		await rejectedSql(client, "delete from catalog_definition_revision where id = $1", [attrA.id], [
			"23514",
		]);
		await rejectedSql(
			client,
			"update catalog_definition_label set label = 'mutated' where definition_revision_id = $1 and language_tag = $2",
			[attrA.id, label.languageTag],
			["55000"],
		);
		await rejectedSql(
			client,
			"delete from catalog_definition_label where definition_revision_id = $1",
			[attrA.id],
			["55000"],
		);
		await rejectedSql(
			client,
			"update catalog_definition_review set reason = 'mutated' where definition_revision_id = $1",
			[attrA.id],
			["55000"],
		);
		await rejectedSql(
			client,
			"delete from catalog_definition_review where definition_revision_id = $1",
			[attrA.id],
			["55000"],
		);
		await client.query("rollback");
	} finally {
		client.release();
	}

	await database
		.update(platformCapabilityGrant)
		.set({ revokedAt: new Date(), revokedByAuthUserId: admin.id })
		.where(eq(platformCapabilityGrant.id, grant.id));
	assert.deepEqual(
		await request("GET", "/catalog/definitions/permissions", undefined, 200, admin.cookie),
		{ canManage: false },
	);
	assertions++;
	await request(
		"POST",
		`/catalog/definitions/${attrB.definitionId}/revisions`,
		{
			expectedVersion: 1,
			valueKind: "string",
			constraints: revisedConstraints,
			labels: english("Denied"),
			reason: privateReason,
		},
		403,
		admin.cookie,
	);

	console.log(
		JSON.stringify({
			check: "catalog-definition-api",
			assertions,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
