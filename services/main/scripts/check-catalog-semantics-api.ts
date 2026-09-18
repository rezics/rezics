import assert from "node:assert/strict";
import Elysia from "elysia";
import { eq, inArray, sql } from "drizzle-orm";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { catalogValueNodes } from "../src/services/catalog/value-nodes";
import type { CatalogReference } from "@rezics/reference";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "@rezics/schema/postgres/identity/auth";
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
		name: "rezics-catalog-semantics-api-fixture",
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
	CatalogParticipantPageSchema,
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

type CreatedSemantic = z.output<typeof CatalogSemanticCreatedSchema>;
type SemanticHead = z.output<typeof CatalogSemanticMutationSchema>;
const factsPage = catalogSemanticPage(CatalogFactSummarySchema);
const relationsPage = catalogSemanticPage(CatalogRelationSummarySchema);
const qualifiersPage = catalogSemanticPage(CatalogQualifierSchema);
const pathFor = (reference: CatalogReference) =>
	`/catalog/resources/${reference.owner}/${reference.id}`;
const nodesFor = (value: unknown) => [...catalogValueNodes(value)];
const readNodesFor = (value: unknown) => nodesFor(value).map(node => {
	const rulePosition = node.parentPosition === null ? 0
		: node.memberKey === "label" ? 1 : node.memberKey === "count" ? 2 : node.memberKey === "enabled" ? 3 : undefined;
	assert.notEqual(rulePosition, undefined, "Read expectation must identify the exact fixture grammar rule");
	return { ...node, rulePosition };
});
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
async function allNodes(reference: CatalogReference, cookie: string, factId: string) {
	const values: z.output<typeof CatalogValuePageSchema>["items"] = [];
	let afterPosition: number | null = -1;
	for (let page = 0; page < 16; page++) {
		const result = CatalogValuePageSchema.parse(
			await request(
				"GET",
				`${pathFor(reference)}/facts/${factId}/nodes?limit=2&afterPosition=${afterPosition}`,
				undefined,
				200,
				cookie,
			),
		);
		values.push(...result.items);
		afterPosition = result.afterPosition;
		if (afterPosition === null) break;
	}
	assert.equal(afterPosition, null);
	assertions++;
	return values;
}
async function allHistory(reference: CatalogReference, cookie: string, semanticId: string) {
	const values: z.output<typeof CatalogSemanticHistorySchema>["items"] = [];
	let afterVersion: number | null = 0;
	for (let page = 0; page < 16; page++) {
		const result = CatalogSemanticHistorySchema.parse(
			await request(
				"GET",
				`${pathFor(reference)}/semantics/${semanticId}/history?limit=2&afterVersion=${afterVersion}`,
				undefined,
				200,
				cookie,
			),
		);
		values.push(...result.items);
		afterVersion = result.afterVersion;
		if (afterVersion === null) break;
	}
	assert.equal(afterVersion, null);
	assertions++;
	return values;
}
async function changeState(
	reference: CatalogReference,
	cookie: string,
	head: SemanticHead,
	state: "disputed" | "withdrawn" | "superseded",
) {
	const metadata = await current(reference, cookie);
	const body = CatalogSemanticStateSchema.parse({
		expectedRevision: metadata.revision,
		expectedHeadVersion: head.headVersion,
		state,
	});
	return CatalogSemanticMutationSchema.parse(
		await request(
			"POST",
			`${pathFor(reference)}/semantics/${head.semanticId}/state`,
			body,
			200,
			cookie,
		),
	);
}
async function restore(
	reference: CatalogReference,
	cookie: string,
	head: SemanticHead,
	restoreVersion: number,
) {
	const metadata = await current(reference, cookie);
	const body = CatalogSemanticRestoreSchema.parse({
		expectedRevision: metadata.revision,
		expectedHeadVersion: head.headVersion,
		restoreVersion,
	});
	return CatalogSemanticMutationSchema.parse(
		await request(
			"POST",
			`${pathFor(reference)}/semantics/${head.semanticId}/restore`,
			body,
			200,
			cookie,
		),
	);
}
async function assertWithdrawnBarrier(
	reference: CatalogReference,
	cookie: string,
	head: SemanticHead,
) {
	for (const state of ["disputed", "superseded"] as const) {
		const metadata = await current(reference, cookie);
		await rejectedWithoutMutation(reference, cookie, () =>
			request(
				"POST",
				`${pathFor(reference)}/semantics/${head.semanticId}/state`,
				{ expectedRevision: metadata.revision, expectedHeadVersion: head.headVersion, state },
				422,
				cookie,
			),
		);
	}
	const metadata = await current(reference, cookie);
	await rejectedWithoutMutation(reference, cookie, () =>
		request(
			"POST",
			`${pathFor(reference)}/semantics/${head.semanticId}/restore`,
			{
				expectedRevision: metadata.revision,
				expectedHeadVersion: head.headVersion,
				restoreVersion: 1,
			},
			422,
			cookie,
		),
	);
}
try {
	const owner = await actor(),
		stranger = await actor();
	const resources = [
		await create({ kind: "text_version", name: name("Semantic text"), languageTag: "ja" }, owner),
		await create({ kind: "release_group", name: name("Semantic music") }, owner),
		await create(
			{
				kind: "program",
				name: name("Semantic program"),
				structure: { shape: "program", fields: {} },
			},
			owner,
		),
		await create({ kind: "software_content", name: name("Semantic software") }, owner),
		await create({ kind: "entity", shape: "person", name: name("Semantic person") }, owner),
		await create({ kind: "grouping", name: name("Semantic grouping") }, owner),
		await create(
			{ kind: "reference", name: name("Semantic concept"), profile: { shape: "concept" } },
			owner,
		),
		await create({ kind: "distribution", name: name("Semantic distribution") }, owner),
	];
	const privateForeign = await create(
		{ kind: "entity", shape: "person", name: name("Private foreign person") },
		stranger,
	);
	const person = resources.find((resource) => resource.reference.owner === "entity");
	assert.ok(person);
	const metadata = await Promise.all(
		resources.map((resource) => current(resource.reference, owner)),
	);
	const identity = await resolveIdentity(
		new Request("http://localhost", { headers: { Cookie: owner } }),
		"account:read",
	);
	if (!("participation" in identity))
		throw new Error("Fixture definitions require explicit participation");
	const namespace = "fixture.semantics." + crypto.randomUUID();
	const meanings = await runWithParticipationAuthority(identity.participation, () =>
		database.transaction(async (tx) => {
			await requireParticipation(tx, identity.participation, "entity.security", {
				owner: "entity",
				id: identity.participation.actingEntityId,
			});
			const constraints = {
				rules: [
					{ position: 0, parent: null, memberKey: null, kind: "object" as const },
					{
						position: 1,
						parent: 0,
						memberKey: "label",
						kind: "string" as const,
						minLength: 1,
						maxLength: 64,
					},
					{
						position: 2,
						parent: 0,
						memberKey: "count",
						kind: "number" as const,
						minimum: 0,
						maximum: 100,
						integer: true,
					},
					{ position: 3, parent: 0, memberKey: "enabled", kind: "boolean" as const },
				],
			};
			const property = await ensureCatalogDefinition(tx, {
				namespace,
				key: "typed_attribute",
				kind: "property",
				valueKind: "object",
				constraints,
			});
			const anotherProperty = await ensureCatalogDefinition(tx, {
				namespace,
				key: "different_meaning",
				kind: "property",
				valueKind: "object",
				constraints,
			});
			const qualifier = await ensureCatalogDefinition(tx, {
				namespace,
				key: "credit_qualifier",
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
			const unlistedRole = await ensureCatalogDefinition(tx, {
				namespace,
				key: "unlisted_role",
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
							targets: metadata.map((row) => ({ owner: row.reference.owner, shapes: [row.shape] })),
						},
						{
							roleRevisionId: actorRole.revisionId,
							min: 1,
							max: 1,
							targets: [{ owner: "entity", shapes: ["person"] }],
						},
					],
					qualifierRevisionIds: [qualifier.revisionId],
				},
			});
			return {
				property,
				anotherProperty,
				qualifier,
				subjectRole,
				actorRole,
				unlistedRole,
				predicate,
			};
		}),
	);
	const foreignQualifier = await writeFact(
		privateForeign.reference,
		stranger,
		meanings.qualifier.revisionId,
		"foreign",
	);
	for (const resource of resources) {
		const reference = resource.reference,
			path = pathFor(reference);
		const initial = await current(reference, owner);
		const firstValue = { label: "Original", count: 2, enabled: true };
		const secondValue = { label: "Replacement", count: 3, enabled: false };
		const first = await writeFact(reference, owner, meanings.property.revisionId, firstValue);
		assert.equal(first.headVersion, 1);
		assertions++;
		assert.deepEqual(await allNodes(reference, owner, first.id), readNodesFor(firstValue));
		assertions++;
		await request("GET", path + "/facts", undefined, 404, stranger);
		await request("GET", `${path}/facts/${first.id}/nodes`, undefined, 404, stranger);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/facts",
				{
					expectedRevision: first.revision,
					definitionRevisionId: meanings.property.revisionId,
					nodes: nodesFor(secondValue),
				},
				403,
				stranger,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/facts",
				{
					expectedRevision: initial.revision,
					definitionRevisionId: meanings.property.revisionId,
					nodes: nodesFor(secondValue),
				},
				409,
				owner,
			),
		);
		const second = await writeFact(
			reference,
			owner,
			meanings.property.revisionId,
			secondValue,
			first,
		);
		assert.equal(second.semanticId, first.semanticId);
		assert.equal(second.headVersion, 2);
		assert.notEqual(second.id, first.id);
		assertions += 3;
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/facts",
				{
					expectedRevision: second.revision,
					definitionRevisionId: meanings.property.revisionId,
					replaces: { semanticId: first.semanticId, headVersion: first.headVersion },
					nodes: nodesFor(firstValue),
				},
				409,
				owner,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/facts",
				{
					expectedRevision: second.revision,
					definitionRevisionId: meanings.property.revisionId,
					replaces: { semanticId: second.semanticId, headVersion: second.headVersion },
					nodes: nodesFor({ label: "Invalid", count: "not numeric", enabled: true }),
				},
				422,
				owner,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/facts",
				{
					expectedRevision: second.revision,
					definitionRevisionId: meanings.anotherProperty.revisionId,
					replaces: { semanticId: second.semanticId, headVersion: second.headVersion },
					nodes: nodesFor(firstValue),
				},
				422,
				owner,
			),
		);
		assert.deepEqual(await allNodes(reference, owner, first.id), readNodesFor(firstValue));
		assertions++;
		let head: SemanticHead = await changeState(reference, owner, second, "disputed");
		const disputed = factsPage.parse(
			await request(
				"GET",
				path + `/facts?definitionRevisionId=${meanings.property.revisionId}`,
				undefined,
				200,
				owner,
			),
		);
		assert.deepEqual(
			disputed.items.map((row) => [row.id, row.state, row.headVersion]),
			[[second.id, "disputed", 3]],
		);
		assertions++;
		head = await restore(reference, owner, head, 1);
		assert.equal(head.headVersion, 4);
		assertions++;
		head = await changeState(reference, owner, head, "withdrawn");
		await assertWithdrawnBarrier(reference, owner, head);
		const third = await writeFact(
			reference,
			owner,
			meanings.property.revisionId,
			{ label: "Reviewed after withdrawal", count: 4, enabled: true },
			head,
		);
		assert.equal(third.headVersion, 6);
		assert.equal(third.semanticId, first.semanticId);
		assert.notEqual(third.id, first.id);
		assertions += 3;
		const factHistory = await allHistory(reference, owner, first.semanticId);
		assert.deepEqual(
			factHistory.map((row) => row.state),
			["active", "active", "disputed", "active", "withdrawn", "active"],
		);
		assert.deepEqual(
			factHistory.map((row) => row.factId),
			[first.id, second.id, second.id, first.id, first.id, third.id],
		);
		assertions += 2;
		await request("GET", `${path}/semantics/${first.semanticId}/history`, undefined, 404, stranger);
		const qualifierA = await writeFact(reference, owner, meanings.qualifier.revisionId, "primary");
		const qualifierB = await writeFact(
			reference,
			owner,
			meanings.qualifier.revisionId,
			"alternate",
		);
		const relationValues = {
			definitionRevisionId: meanings.predicate.revisionId,
			participants: [
				{ roleRevisionId: meanings.subjectRole.revisionId, target: reference },
				{
					roleRevisionId: meanings.actorRole.revisionId,
					target: person.reference,
					creditedAs: "Fixture contributor",
				},
			],
			qualifiers: [
				{ definitionRevisionId: meanings.qualifier.revisionId, valueFactId: qualifierA.id },
			],
		};
		const writeRelation = async (qualifierId: string, replaces?: SemanticHead) => {
			const now = await current(reference, owner);
			const body = WriteCatalogRelationSchema.parse({
				...relationValues,
				expectedRevision: now.revision,
				qualifiers: [
					{ definitionRevisionId: meanings.qualifier.revisionId, valueFactId: qualifierId },
				],
				...(replaces
					? { replaces: { semanticId: replaces.semanticId, headVersion: replaces.headVersion } }
					: {}),
			});
			return CatalogSemanticCreatedSchema.parse(
				await request("POST", path + "/relations", body, 200, owner),
			);
		};
		const relationA = await writeRelation(qualifierA.id),
			relationB = await writeRelation(qualifierB.id);
		assert.notEqual(relationA.id, relationB.id);
		assert.notEqual(relationA.semanticId, relationB.semanticId);
		assertions += 2;
		for (const [relationId, qualifierId] of [
			[relationA.id, qualifierA.id],
			[relationB.id, qualifierB.id],
		] as const) {
			const participants = CatalogParticipantPageSchema.parse(
				await request("GET", `${path}/relations/${relationId}/participants`, undefined, 200, owner),
			);
			assert.deepEqual(
				participants.items.map((row) => [row.roleRevisionId, row.target]),
				[
					[meanings.subjectRole.revisionId, reference],
					[meanings.actorRole.revisionId, person.reference],
				],
			);
			assertions++;
			const qualifiers = qualifiersPage.parse(
				await request("GET", `${path}/relations/${relationId}/qualifiers`, undefined, 200, owner),
			);
			assert.deepEqual(
				qualifiers.items.map((row) => [row.definitionRevisionId, row.valueFactId]),
				[[meanings.qualifier.revisionId, qualifierId]],
			);
			assertions++;
		}
		const relationRevision = (await current(reference, owner)).revision;
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/relations",
				{
					...relationValues,
					expectedRevision: relationRevision,
				},
				403,
				stranger,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				`${path}/semantics/${relationA.semanticId}/state`,
				{
					expectedRevision: relationRevision,
					expectedHeadVersion: relationA.headVersion,
					state: "disputed",
				},
				403,
				stranger,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				`${path}/semantics/${relationA.semanticId}/restore`,
				{
					expectedRevision: relationRevision,
					expectedHeadVersion: relationA.headVersion,
					restoreVersion: 1,
				},
				403,
				stranger,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/relations",
				{
					...relationValues,
					expectedRevision: relationRevision,
					participants: [
						{ roleRevisionId: meanings.unlistedRole.revisionId, target: reference },
						relationValues.participants[1],
					],
				},
				422,
				owner,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/relations",
				{
					...relationValues,
					expectedRevision: relationRevision,
					qualifiers: [
						{
							definitionRevisionId: meanings.qualifier.revisionId,
							valueFactId: foreignQualifier.id,
						},
					],
				},
				422,
				owner,
			),
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/relations",
				{
					...relationValues,
					expectedRevision: relationRevision,
					participants: [
						relationValues.participants[0],
						{ roleRevisionId: meanings.actorRole.revisionId, target: privateForeign.reference },
					],
				},
				403,
				owner,
			),
		);
		await request("GET", path + "/relations", undefined, 404, stranger);
		await request(
			"GET",
			`${path}/relations/${relationA.id}/participants`,
			undefined,
			404,
			stranger,
		);
		await request("GET", `${path}/relations/${relationA.id}/qualifiers`, undefined, 404, stranger);
		await publishWithVisibility(privateForeign.reference, stranger, "public");
		const publicParticipantRelation = CatalogSemanticCreatedSchema.parse(
			await request(
				"POST",
				path + "/relations",
				{
					...relationValues,
					expectedRevision: (await current(reference, owner)).revision,
					participants: [
						relationValues.participants[0],
						{ roleRevisionId: meanings.actorRole.revisionId, target: privateForeign.reference },
					],
				},
				200,
				owner,
			),
		);
		await publishWithVisibility(privateForeign.reference, stranger, "private");
		await request(
			"GET",
			`${path}/relations/${publicParticipantRelation.id}/participants`,
			undefined,
			404,
			owner,
		);
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				`${path}/semantics/${publicParticipantRelation.semanticId}/restore`,
				{
					expectedRevision: publicParticipantRelation.revision,
					expectedHeadVersion: 1,
					restoreVersion: 1,
				},
				422,
				owner,
			),
		);
		await changeState(reference, owner, publicParticipantRelation, "withdrawn");
		const replacedRelation = await writeRelation(qualifierB.id, relationA);
		const historicalQualifier = qualifiersPage.parse(
			await request("GET", `${path}/relations/${relationA.id}/qualifiers`, undefined, 200, owner),
		);
		assert.deepEqual(
			historicalQualifier.items.map((row) => row.valueFactId),
			[qualifierA.id],
		);
		assertions++;
		await rejectedWithoutMutation(reference, owner, () =>
			request(
				"POST",
				path + "/relations",
				{
					...relationValues,
					expectedRevision: replacedRelation.revision,
					replaces: { semanticId: relationA.semanticId, headVersion: 1 },
				},
				409,
				owner,
			),
		);
		let relationHead: SemanticHead = await changeState(
			reference,
			owner,
			replacedRelation,
			"disputed",
		);
		relationHead = await restore(reference, owner, relationHead, 1);
		relationHead = await changeState(reference, owner, relationHead, "withdrawn");
		await assertWithdrawnBarrier(reference, owner, relationHead);
		const renewedRelation = await writeRelation(qualifierA.id, relationHead);
		assert.equal(renewedRelation.headVersion, 6);
		assert.equal(renewedRelation.semanticId, relationA.semanticId);
		assertions += 2;
		const relationHistory = await allHistory(reference, owner, relationA.semanticId);
		assert.deepEqual(
			relationHistory.map((row) => row.state),
			["active", "active", "disputed", "active", "withdrawn", "active"],
		);
		assert.deepEqual(
			relationHistory.map((row) => row.relationId),
			[
				relationA.id,
				replacedRelation.id,
				replacedRelation.id,
				relationA.id,
				relationA.id,
				renewedRelation.id,
			],
		);
		assertions += 2;
		const currentRelations = relationsPage.parse(
			await request("GET", path + "/relations", undefined, 200, owner),
		);
		assert.deepEqual(
			new Set(currentRelations.items.map((row) => row.id)),
			new Set([renewedRelation.id, relationB.id]),
		);
		assertions++;
		await request(
			"GET",
			`${path}/semantics/${relationA.semanticId}/history`,
			undefined,
			404,
			stranger,
		);
	}
	console.log(
		JSON.stringify({
			check: "catalog-semantics-api",
			owners: 8,
			assertions,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
