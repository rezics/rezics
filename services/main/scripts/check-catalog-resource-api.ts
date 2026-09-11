import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
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
import {
	FavoriteListSchema,
	FavoriteMutationSchema,
	FavoriteRevisionSchema,
	FavoriteStateSchema,
} from "../src/services/favorites/contracts";
import { catalogUnitLocator } from "../src/services/database/schema/catalog-identity";

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
let concurrentClientWarnings = 0;
const recordWarning = (warning: Error) => {
	if (
		warning.message.startsWith(
			"Calling client.query() when the client is already executing a query",
		)
	)
		concurrentClientWarnings++;
};
process.on("warning", recordWarning);
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
	const privateCollection = z.object({ id: z.uuid() }).parse(
		await request(
			"POST",
			"/collections",
			{
				visibility: "private",
				localization: { language: "en", title: "Private scoped Collection" },
			},
			200,
			owner.cookie,
		),
	);
	await database
		.update(users)
		.set({ name: "Private Auth-only label" })
		.where(eq(users.id, delegate.account.id));
	const collectionPath = `/collections/${privateCollection.id}`;
	const collectionAccessPath = `/governance/unit/${privateCollection.id}/access`;
	const readDecision = (value: unknown) =>
		z
			.object({
				decisions: z.array(
					z.object({
						permission: z.string(),
						decision: z.object({ allowed: z.boolean() }).passthrough(),
					}),
				),
			})
			.parse(value)
			.decisions.find((row) => row.permission === "unit.read")?.decision.allowed;
	const scopedAccessSnapshot = await request(
		"PUT",
		collectionAccessPath,
		{
			subject: { kind: "auth", authUserId: delegate.account.id },
			grants: ["unit.read"],
			restrictions: [],
			scope: ["section", "one"],
		},
		200,
		owner.cookie,
	);
	const listedRecipient = z
		.object({
			subjects: z.array(
				z.object({
					subject: z.object({ kind: z.string(), authUserId: z.string().optional() }).passthrough(),
					label: z.string().nullable(),
				}),
			),
		})
		.parse(scopedAccessSnapshot)
		.subjects.find((row) => row.subject.authUserId === delegate.account.id);
	assert.equal(
		listedRecipient?.label,
		delegate.self.name,
		"access management uses the recipient's public Entity name",
	);
	assert.equal(JSON.stringify(scopedAccessSnapshot).includes("Private Auth-only label"), false);
	assertions += 2;
	await request("GET", collectionPath, undefined, 404, delegate.cookie);
	assert.equal(
		readDecision(
			await request("GET", `${collectionAccessPath}/effective`, undefined, 200, delegate.cookie),
		),
		false,
	);
	assertions++;
	await request(
		"PUT",
		collectionAccessPath,
		{
			subject: { kind: "auth", authUserId: delegate.account.id },
			grants: ["unit.read"],
			restrictions: [],
			scope: [],
		},
		200,
		owner.cookie,
	);
	await request("GET", collectionPath, undefined, 200, delegate.cookie);
	assert.equal(
		readDecision(
			await request("GET", `${collectionAccessPath}/effective`, undefined, 200, delegate.cookie),
		),
		true,
	);
	assertions++;
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
	let favoriteRevision = 0;
	for (const resource of created.values()) {
		const favorite = FavoriteMutationSchema.parse(
			await request(
				"PUT",
				`/favorites/${resource.reference.id}`,
				{ expectedRevision: favoriteRevision },
				200,
				owner.cookie,
			),
		);
		assert.deepEqual(favorite.entry?.target, resource.reference);
		assertions++;
		favoriteRevision = favorite.revision;
	}
	const createdIds = [...created.values()].map((resource) => resource.reference.id);
	const locators = await database
		.select({ id: catalogUnitLocator.id, owner: catalogUnitLocator.owner })
		.from(catalogUnitLocator)
		.where(inArray(catalogUnitLocator.id, createdIds));
	assert.equal(locators.length, createdIds.length);
	assertions++;
	for (const resource of created.values()) {
		const locator = locators.find((row) => row.id === resource.reference.id);
		assert.ok(locator);
		assert.equal(locator.owner, resource.reference.owner);
		assertions += 2;
	}
	const privateFavorites = FavoriteListSchema.parse(
		await request("GET", "/favorites", undefined, 200, delegate.cookie),
	);
	assert.equal(privateFavorites.items.length, 0);
	assertions++;
	await request(
		"PUT",
		`/favorites/${publication.reference.id}`,
		{ expectedRevision: 0 },
		404,
		delegate.cookie,
	);
	await request(
		"PUT",
		`/favorites/${publication.reference.id}`,
		{ expectedRevision: 0 },
		409,
		owner.cookie,
	);
	const savedState = FavoriteStateSchema.parse(
		await request("GET", `/favorites/${publication.reference.id}`, undefined, 200, owner.cookie),
	);
	assert.ok(savedState.entry);
	const savedRevision = savedState.entry.revision;
	const savedHistory = FavoriteRevisionSchema.parse(
		await request(
			"GET",
			`/favorites/${publication.reference.id}/history/${savedRevision}`,
			undefined,
			200,
			owner.cookie,
		),
	);
	assert.deepEqual(savedHistory.snapshot?.target, publication.reference);
	assertions++;
	favoriteRevision = FavoriteMutationSchema.parse(
		await request(
			"DELETE",
			`/favorites/${publication.reference.id}`,
			{ expectedRevision: favoriteRevision },
			200,
			owner.cookie,
		),
	).revision;
	const restoredFavorite = FavoriteMutationSchema.parse(
		await request(
			"POST",
			`/favorites/${publication.reference.id}/restore`,
			{ expectedRevision: favoriteRevision, revision: savedRevision },
			200,
			owner.cookie,
		),
	);
	assert.deepEqual(restoredFavorite.entry?.target, publication.reference);
	assertions++;
	favoriteRevision = restoredFavorite.revision;
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
		"/catalog/resources",
		{ kind: "publishing_work", name: name("Scoped grant cannot admit another identity") },
		403,
		delegate.cookie,
		selection,
	);
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
	const refreshedFavorite = FavoriteMutationSchema.parse(
		await request(
			"PUT",
			`/favorites/${publication.reference.id}`,
			{ expectedRevision: favoriteRevision, refreshPreview: true },
			200,
			owner.cookie,
			{
				actingEntityId: organization.entityId,
				grant: { id: publishGrant.id, revision: publishGrant.revision },
			},
		),
	);
	assert.deepEqual(refreshedFavorite.entry?.target, publication.reference);
	assertions++;
	CatalogResourceSchema.parse(
		await request("GET", path, undefined, 200, owner.cookie, {
			actingEntityId: organization.entityId,
			grant: { id: publishGrant.id, revision: publishGrant.revision },
		}),
	);
	await request("GET", path, undefined, 404, delegate.cookie);
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.equal(
		concurrentClientWarnings,
		0,
		"API flows await queries sharing a PostgreSQL transaction client",
	);
	assertions++;
	console.log(
		JSON.stringify({
			check: "catalog-resource-api",
			assertions,
			createdResources: created.size,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	process.off("warning", recordWarning);
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
