import assert from "node:assert/strict";
import { inArray } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { z } from "zod";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "../src/services/database/schema/auth";
import { accountPreference } from "../src/services/database/schema/account-preference";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	CatalogCreatedSchema,
	CatalogResourceSchema,
	CatalogNamePageSchema,
	CatalogNameCreatedSchema,
	CatalogNamedFormSchema,
	CatalogIdentifierCreatedSchema,
	CatalogIdentifierPageSchema,
	CatalogMutationSchema,
	CreateCatalogResourceSchema,
} from "../src/services/catalog/resource-contracts";
import {
	GrantSelectionSchema,
	CreatedOrganizationSchema,
} from "../src/services/api/participation/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable API fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("API qualification requires the isolated loopback Atlas target");
const observability = initializeObservability({
	service: { name: "rezics-catalog-api-qualification", version: "1.0.0", environment: "tooling" },
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const context = await auth.$context;
const accounts: string[] = [];
let assertions = 0;

async function actor(label: string) {
	const person = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({ name: label, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
			.returning();
		assert.ok(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		return { account, self };
	});
	accounts.push(person.account.id);
	const session = await context.internalAdapter.createSession(person.account.id);
	const [cookie] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			session.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { ...person, cookie };
}

async function request(
	method: string,
	path: string,
	body: unknown,
	expectedStatus: number,
	cookie?: string,
	selection?: unknown,
) {
	const headers = new Headers({ Accept: "application/json" });
	if (body !== undefined) headers.set("Content-Type", "application/json");
	if (cookie) headers.set("Cookie", cookie);
	if (selection) headers.set("X-Rezics-Participation", JSON.stringify(selection));
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 2000)}`);
	assertions++;
	const value: unknown = text ? JSON.parse(text) : null;
	return value;
}
const name = (value: string) => ({ value, languageTag: "en" });
const created = new Map<string, z.infer<typeof CatalogCreatedSchema>>();
async function create(
	label: string,
	body: z.input<typeof CreateCatalogResourceSchema>,
	cookie: string,
) {
	const record = CatalogCreatedSchema.parse(
		await request("POST", "/catalog/resources", body, 200, cookie),
	);
	created.set(label, record);
	const path = `/catalog/resources/${record.reference.owner}/${record.reference.id}`;
	const metadata = CatalogResourceSchema.parse(await request("GET", path, undefined, 200, cookie));
	assert.equal(metadata.revision, record.revision);
	assertions++;
	assert.equal(JSON.stringify(metadata).includes("AuthUserId"), false);
	assertions++;
	return record;
}

try {
	const owner = await actor("Private catalog fixture account"),
		delegate = await actor("Private delegated fixture account");
	await request(
		"POST",
		"/catalog/resources",
		{ kind: "publishing_work", name: name("Unauthenticated") },
		401,
	);
	const inputs: z.input<typeof CreateCatalogResourceSchema>[] = [
		{ kind: "publishing_work", name: name("Catalog API work") },
		{ kind: "text_version", name: name("Catalog API translation"), languageTag: "ja" },
		{ kind: "publication", name: name("Catalog API publication"), pageCount: 240 },
		{ kind: "serialization", name: name("Catalog API serialization") },
		{ kind: "musical_work", name: name("Catalog API musical work") },
		{ kind: "recording", name: name("Catalog API recording"), lengthMilliseconds: 120000 },
		{ kind: "release_group", name: name("Catalog API release group") },
		{
			kind: "music_release",
			name: name("Catalog API physical album"),
			languageTag: "ja",
			scriptCode: "Jpan",
		},
		{ kind: "software_content", name: name("Catalog API visual novel"), visualNovel: true },
		{ kind: "software_release", name: name("Catalog API software release") },
		{
			kind: "program",
			name: name("Catalog API program"),
			structure: { shape: "program", fields: { declaredMainEpisodeCount: 12 } },
		},
		{ kind: "entity", name: name("Catalog API person"), shape: "person" },
		{
			kind: "reference",
			name: name("Catalog API place"),
			profile: { shape: "place", address: "Fixture venue" },
		},
		{ kind: "grouping", name: name("Catalog API franchise") },
		{ kind: "distribution", name: name("Catalog API package") },
	];
	for (const input of inputs) await create(input.kind, input, owner.cookie);
	const content = created.get("software_content");
	assert.ok(content);
	await create(
		"software_version",
		{
			kind: "software_version",
			name: name("Catalog API version"),
			content: content.reference,
			details: {
				kind: "revision",
				versionLabel: "1.0",
				distinguishingEvidence: "Named revision explicitly supplied by the fixture author",
			},
		},
		owner.cookie,
	);
	const publication = created.get("publication");
	assert.ok(publication);
	const path = `/catalog/resources/${publication.reference.owner}/${publication.reference.id}`;
	await request("GET", path, undefined, 404);
	await request("GET", path, undefined, 404, delegate.cookie);
	let revision = CatalogMutationSchema.parse(
		await request(
			"PATCH",
			`${path}/lifecycle`,
			{
				expectedRevision: publication.revision,
				status: "published",
				visibility: "public",
				contentRating: "general",
			},
			200,
			owner.cookie,
		),
	).revision;
	CatalogResourceSchema.parse(await request("GET", path, undefined, 200));
	const named = CatalogNameCreatedSchema.parse(
		await request(
			"POST",
			`${path}/names`,
			{
				expectedRevision: revision,
				value: {
					value: "A separate translated name",
					kind: "translation",
					languageTag: "zh-Hans",
					origin: "translation",
					translationMethod: "human",
				},
			},
			200,
			owner.cookie,
		),
	);
	revision = named.revision;
	const edited = CatalogNamedFormSchema.parse(
		await request(
			"PUT",
			`${path}/names/${named.id}`,
			{
				expectedRevision: named.nameRevision,
				value: {
					value: "A corrected translated name",
					kind: "translation",
					languageTag: "zh-Hans",
					origin: "translation",
					translationMethod: "human",
				},
			},
			200,
			owner.cookie,
		),
	);
	assert.equal(edited.revision, 2);
	assertions++;
	await request(
		"PUT",
		`${path}/names/${named.id}`,
		{
			expectedRevision: 1,
			value: { value: "Stale edit", kind: "translation", languageTag: "zh-Hans" },
		},
		409,
		owner.cookie,
	);
	const names = CatalogNamePageSchema.parse(await request("GET", `${path}/names`, undefined, 200));
	assert.ok(
		names.items.some(
			(item) => item.id === named.id && item.value === "A corrected translated name",
		),
	);
	assertions++;
	assert.equal(JSON.stringify(names).includes(owner.account.id), false);
	assertions++;
	const identifier = CatalogIdentifierCreatedSchema.parse(
		await request(
			"POST",
			`${path}/identifiers`,
			{ expectedRevision: revision, value: { namespace: "isbn", value: "978-0-306-40615-7" } },
			200,
			owner.cookie,
		),
	);
	revision = identifier.revision;
	const identifiers = CatalogIdentifierPageSchema.parse(
		await request("GET", `${path}/identifiers`, undefined, 200),
	);
	assert.equal(
		identifiers.items.find((item) => item.id === identifier.id)?.normalizedValue,
		"9780306406157",
	);
	assertions++;
	assert.equal(JSON.stringify(identifiers).includes(owner.account.id), false);
	assertions++;
	await request(
		"POST",
		`${path}/identifiers`,
		{ expectedRevision: revision, value: { namespace: "isbn", value: "9780306406158" } },
		422,
		owner.cookie,
	);
	const grant = GrantSelectionSchema.parse(
		await request(
			"POST",
			"/participation/grants",
			{
				recipient: { kind: "account", entityId: delegate.self.id },
				actingEntityId: delegate.self.id,
				capability: "catalog.edit",
				target: publication.reference,
				expiresAt: new Date(Date.now() + 3600000).toISOString(),
			},
			200,
			owner.cookie,
		),
	);
	const selection = { actingEntityId: delegate.self.id, grant };
	await request(
		"POST",
		`${path}/names`,
		{
			expectedRevision: revision,
			value: { value: "Denied ordinary edit", kind: "alias", languageTag: "en" },
		},
		403,
		delegate.cookie,
	);
	const delegated = CatalogNameCreatedSchema.parse(
		await request(
			"POST",
			`${path}/names`,
			{
				expectedRevision: revision,
				value: { value: "Authorized delegated alias", kind: "alias", languageTag: "en" },
			},
			200,
			delegate.cookie,
			selection,
		),
	);
	revision = delegated.revision;
	await request(
		"POST",
		`/catalog/resources/${content.reference.owner}/${content.reference.id}/names`,
		{
			expectedRevision: content.revision,
			value: { value: "Denied other target", kind: "alias", languageTag: "en" },
		},
		403,
		delegate.cookie,
		selection,
	);
	await request(
		"POST",
		`/participation/grants/${grant.id}/revoke`,
		{ expectedRevision: grant.revision },
		200,
		owner.cookie,
	);
	await request(
		"POST",
		`${path}/names`,
		{
			expectedRevision: revision,
			value: { value: "Revoked alias", kind: "alias", languageTag: "en" },
		},
		403,
		delegate.cookie,
		selection,
	);
	revision = CatalogMutationSchema.parse(
		await request(
			"PATCH",
			`${path}/lifecycle`,
			{
				expectedRevision: revision,
				status: "published",
				visibility: "public",
				contentRating: "r18",
			},
			200,
			owner.cookie,
		),
	).revision;
	await request("GET", path, undefined, 404);
	await request("GET", path, undefined, 404, owner.cookie);
	await database
		.insert(accountPreference)
		.values({ authUserId: owner.account.id, contentRatings: ["general", "r18"] })
		.onConflictDoUpdate({
			target: accountPreference.authUserId,
			set: { contentRatings: ["general", "r18"] },
		});
	CatalogResourceSchema.parse(await request("GET", path, undefined, 200, owner.cookie));
	const organization = CreatedOrganizationSchema.parse(
		await request(
			"POST",
			"/participation/organizations",
			{ name: "Catalog API organization", language: "en" },
			200,
			owner.cookie,
		),
	);
	const publishGrant = organization.grants.find((item) => item.capability === "entity.publish");
	assert.ok(publishGrant);
	CatalogResourceSchema.parse(
		await request("GET", path, undefined, 200, owner.cookie, {
			actingEntityId: organization.entityId,
			grant: { id: publishGrant.id, revision: publishGrant.revision },
		}),
	);
	await request("GET", path, undefined, 404, delegate.cookie);
	console.log(
		JSON.stringify({
			check: "catalog-resource-api",
			assertions,
			createdResources: created.size,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
