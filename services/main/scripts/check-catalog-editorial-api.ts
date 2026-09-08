import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import { serializeSignedCookie } from "better-call";
import { z } from "zod";
import { createBlockKey, createPortableTextDocument } from "@rezics/block";
import { parseContentLanguageTag } from "@rezics/content-language";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	CatalogCreatedSchema,
	CatalogMutationSchema,
	CatalogResourceSchema,
	CreateCatalogResourceSchema,
} from "../src/services/catalog/resource-contracts";
import { CatalogEditorialTables } from "../src/services/database/schema/catalog-editorial";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { CatalogOwnerValues, type CatalogReference } from "../src/services/catalog/contracts";
import { EntityProfileSchema } from "../src/services/catalog/entity-contracts";

const expectedPort = "25435";
const expectedDatabase = "rezics_atlas_native_final_20260908";
const connectionString = process.env.DATABASE_URL;
const fixturePort = process.env.REZICS_CATALOG_FIXTURE_PORT;
const fixtureDatabase = process.env.REZICS_CATALOG_FIXTURE_DATABASE;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable API fixture required");
if (!fixturePort || !fixtureDatabase)
	throw new Error("Explicit REZICS_CATALOG_FIXTURE_PORT and REZICS_CATALOG_FIXTURE_DATABASE required");
const target = new URL(connectionString);
if(target.port==="15432") throw new Error("Development database is not a disposable fixture");
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.port !== expectedPort ||
	target.port !== fixturePort ||
	target.pathname !== `/${expectedDatabase}` ||
	fixtureDatabase !== expectedDatabase ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error(
		`Requires isolated loopback Atlas fixture 127.0.0.1:${expectedPort}/${expectedDatabase}`,
	);

const observability = initializeObservability({
	service: { name: "rezics-catalog-editorial-api-fixture", version: "1.0.0", environment: "tooling" },
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: errors } = await import("../src/services/api/error-boundary");
const { resolveIdentity } = await import("../src/services/auth/session");
const { runWithParticipationAuthority } = await import("../src/services/participation/policy");
const { readUnitPresentationsInTransaction } = await import(
	"../src/services/units/presentation-reader"
);
const Elysia = (await import("elysia")).default;
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(catalog);
api.compile();
const authContext = await auth.$context;
const accounts: string[] = [];
let assertions = 0;
const coverage: string[] = [];
const unexecuted: string[] = [];
const explainPlans: unknown[] = [];

function covered(name: string) {
	coverage.push(name);
}

type Actor = { cookie: string; userId: string; entityId: string };

async function actor(label: string): Promise<Actor> {
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
		const entity = await ensureSelfEntityInTransaction(tx, row);
		return { ...row, entityId: entity.id };
	});
	accounts.push(account.id);
	const session = await authContext.internalAdapter.createSession(account.id);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { cookie, userId: account.id, entityId: account.entityId };
}

function catalogRequest(method: string, path: string, body: unknown, cookie?: string) {
	const headers = new Headers({ Accept: "application/json" });
	if (cookie) headers.set("Cookie", cookie);
	if (body !== undefined) headers.set("Content-Type", "application/json");
	return new Request(`http://localhost:3001/api/v1${path}`, {
		method,
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

async function captureCatalogIdentity(path: string, cookie: string, fixture: Actor, permission: "unit:read" | "unit:update") {
	const resolved = await resolveIdentity(catalogRequest("GET", path, undefined, cookie), permission);
	const base = {
		path,
		permission,
		cookieHeaderPresent: cookie.length > 0,
		fixtureUserId: fixture.userId,
		fixtureEntityId: fixture.entityId,
	};
	if (!("participation" in resolved))
		return {
			...base,
			hasParticipation: false as const,
			principalAuthUserId: null,
			actingEntityId: null,
			authorizationRevision: null,
		};
	assert.equal(resolved.principal.authUserId, fixture.userId);
	assert.equal(resolved.entity.id, fixture.entityId);
	assertions += 2;
	return {
		...base,
		hasParticipation: true as const,
		principalAuthUserId: resolved.principal.authUserId,
		actingEntityId: resolved.actingEntityId,
		authorizationRevision: resolved.authorizationRevision,
		grant: resolved.participation.grant ?? null,
	};
}

async function request(
	method: string,
	path: string,
	body: unknown,
	expectedStatus: number,
	cookie?: string,
) {
	const response = await api.fetch(catalogRequest(method, path, body, cookie));
	const text = await response.text();
	assert.equal(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 2500)}`);
	assertions++;
	assert.equal(text.includes("AuthUserId"), false);
	assertions++;
	assert.equal(text.includes("operatorAuthUserId"), false);
	assertions++;
	return { status: response.status, value: text ? (JSON.parse(text) as unknown) : null, text };
}

const name = (value: string) => ({ value, languageTag: "en" as const });
const created = new Map<string, z.infer<typeof CatalogCreatedSchema>>();

const EditorialMutationSchema = z.strictObject({
	revision: z.number().int().positive(),
	editorialRevision: z.number().int().positive(),
});
const EditorialContentSchema = z.strictObject({
	summary: z.string().nullable(),
	description: z.unknown().nullable(),
	avatar: z.unknown().nullable(),
	bannerAssetId: z.string().uuid().nullable(),
	coverAssetId: z.string().uuid().nullable(),
});
const EditorialResponseSchema = z.strictObject({
	language: z.string().min(1),
	revision: z.number().int().positive(),
	editorialRevision: z.number().int().nonnegative(),
	content: EditorialContentSchema.nullable(),
	avatar: z.unknown(),
	banner: z.unknown(),
	cover: z.unknown(),
});
const EditorialLanguagesSchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				language: z.string().min(1),
				editorialRevision: z.number().int().positive(),
				state: z.enum(["active", "withdrawn"]),
			}),
		)
		.max(32),
});
const EditorialHistorySchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				editorialRevision: z.number().int().positive(),
				createdAt: z.iso.datetime(),
			}),
		)
		.max(100),
	nextCursor: z.string().nullable(),
});
const EntityProfileResponseSchema = z.strictObject({
	owner: z.literal("entity"),
	id: z.uuid(),
	shape: z.string(),
	revision: z.number().int().positive(),
	profile: EntityProfileSchema,
});
const EntityProfileMutationSchema = z.strictObject({ revision: z.number().int().positive() });
const EntityProfileHistorySchema = z.strictObject({
	items: z
		.array(
			z.strictObject({
				revision: z.number().int().positive(),
				removed: z.boolean(),
				createdAt: z.iso.datetime(),
				profile: EntityProfileSchema.nullable(),
			}),
		)
		.max(100),
	nextCursor: z.string().nullable(),
});

function editorialPath(reference: CatalogReference, language?: string) {
	const base = `/catalog/resources/${reference.owner}/${reference.id}/editorial`;
	return language ? `${base}/${language}` : base;
}

function portable(text: string) {
	return createPortableTextDocument([
		{
			_type: "block",
			_key: createBlockKey(),
			style: "normal",
			children: [{ _type: "span", _key: createBlockKey(), text }],
		},
	]);
}

const emoji = "📚";
function authoredContent(summary: string, body: string) {
	return {
		summary,
		description: portable(body),
		avatar: { type: "emoji" as const, emoji },
		bannerAssetId: null,
		coverAssetId: null,
	};
}

async function create(
	label: string,
	body: z.input<typeof CreateCatalogResourceSchema>,
	cookie: string,
) {
	const record = CatalogCreatedSchema.parse(
		(await request("POST", "/catalog/resources", body, 200, cookie)).value,
	);
	created.set(label, record);
	return record;
}

async function currentResource(reference: CatalogReference, cookie: string) {
	return CatalogResourceSchema.parse(
		(await request("GET", `/catalog/resources/${reference.owner}/${reference.id}`, undefined, 200, cookie))
			.value,
	);
}

async function publish(reference: CatalogReference, cookie: string, visibility: "public" | "private") {
	const metadata = await currentResource(reference, cookie);
	return CatalogMutationSchema.parse(
		(
			await request(
				"PATCH",
				`/catalog/resources/${reference.owner}/${reference.id}/lifecycle`,
				{
					expectedRevision: metadata.revision,
					status: "published",
					visibility,
					contentRating: metadata.contentRating,
				},
				200,
				cookie,
			)
		).value,
	);
}

async function editorialSnapshot(reference: CatalogReference) {
	const current = CatalogEditorialTables[reference.owner].current;
	const history = CatalogEditorialTables[reference.owner].history;
	const identity = CatalogIdentityTables[reference.owner];
	const [meta] = await database
		.select({ revision: identity.revision })
		.from(identity)
		.where(eq(identity.id, reference.id))
		.limit(1);
	assert.ok(meta);
	const rows = await database
		.select({
			language: current.language,
			revision: current.revision,
			state: current.state,
			summary: current.summary,
		})
		.from(current)
		.where(eq(current.ownerId, reference.id));
	const historyRows = await database
		.select({ language: history.language, revision: history.revision })
		.from(history)
		.where(eq(history.ownerId, reference.id));
	return {
		ownerRevision: meta.revision,
		current: rows.toSorted((a, b) => a.language.localeCompare(b.language)),
		history: historyRows.toSorted(
			(a, b) => a.language.localeCompare(b.language) || a.revision - b.revision,
		),
	};
}

function postgresError(error: unknown) {
	let current: unknown = error;
	for (let depth = 0; depth < 6 && current && typeof current === "object"; depth++) {
		const record = current as { code?: unknown; constraint?: unknown; message?: unknown; cause?: unknown };
		if (typeof record.code === "string")
			return {
				code: record.code,
				constraint: typeof record.constraint === "string" ? record.constraint : null,
				message: typeof record.message === "string" ? record.message : String(error),
			};
		current = record.cause;
	}
	return {
		code: null,
		constraint: null,
		message: error instanceof Error ? error.message : String(error),
	};
}

const languageCandidates = [
	"en",
	"en-US",
	"en-GB",
	"en-AU",
	"en-CA",
	"ja",
	"ja-JP",
	"ko",
	"ko-KR",
	"zh-Hans",
	"zh-Hant",
	"fr",
	"fr-FR",
	"fr-CA",
	"de",
	"de-DE",
	"es",
	"es-ES",
	"es-MX",
	"it",
	"it-IT",
	"pt",
	"pt-BR",
	"pt-PT",
	"ru",
	"ar",
	"hi",
	"th",
	"vi",
	"id",
	"nl",
	"sv",
	"da",
	"fi",
	"pl",
	"tr",
	"cs",
	"hu",
	"el",
	"he",
	"uk",
	"ro",
];

function registeredLanguageTags(count: number) {
	const tags: string[] = [];
	for (const candidate of languageCandidates) {
		const parsed = parseContentLanguageTag(candidate);
		if (parsed.kind !== "registered") continue;
		if (tags.includes(parsed.tag)) continue;
		tags.push(parsed.tag);
		if (tags.length === count) return tags;
	}
	throw new Error(`Need ${count} registered BCP 47 tags, found ${tags.length}`);
}

async function compactEditorial(reference: CatalogReference, owner: Actor, label: string) {
	const list = EditorialLanguagesSchema.parse(
		(await request("GET", editorialPath(reference), undefined, 200, owner.cookie)).value,
	);
	assert.equal(list.items.length, 0);
	assertions++;
	const absent = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(reference, "en"), undefined, 200, owner.cookie)).value,
	);
	assert.equal(absent.content, null);
	assert.equal(absent.editorialRevision, 0);
	assert.equal(absent.language, "en");
	assertions += 3;
	const metadata = await currentResource(reference, owner.cookie);
	const summary = `${label} summary`;
	const mutation = EditorialMutationSchema.parse(
		(
			await request(
				"PUT",
				editorialPath(reference, "en"),
				{
					expectedRevision: metadata.revision,
					expectedEditorialRevision: 0,
					content: authoredContent(summary, `${label} body`),
				},
				200,
				owner.cookie,
			)
		).value,
	);
	const roundtrip = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(reference, "en"), undefined, 200, owner.cookie)).value,
	);
	assert.equal(roundtrip.editorialRevision, mutation.editorialRevision);
	assert.equal(roundtrip.content?.summary, summary);
	assert.deepEqual(roundtrip.content?.avatar, { type: "emoji", emoji });
	assert.equal(JSON.stringify(roundtrip.content?.description).includes(`${label} body`), true);
	assertions += 4;
	const languages = EditorialLanguagesSchema.parse(
		(await request("GET", editorialPath(reference), undefined, 200, owner.cookie)).value,
	);
	assert.ok(
		languages.items.some(
			(item) => item.language === "en" && item.state === "active" && item.editorialRevision === 1,
		),
	);
	assertions++;
	covered(`compact-${label}-${reference.owner}`);
	return { mutation, roundtrip };
}

try {
	const installed = await database.execute(sql`
		select c.relname
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public'
			and c.relkind in ('r', 'p')
			and c.relname in (
				'publishing_editorial','music_editorial','program_editorial','software_editorial',
				'entity_editorial','grouping_editorial','reference_editorial','distribution_editorial',
				'publishing_editorial_revision','music_editorial_revision','program_editorial_revision',
				'software_editorial_revision','entity_editorial_revision','grouping_editorial_revision',
				'reference_editorial_revision','distribution_editorial_revision'
			)
		order by c.relname
	`);
	assert.equal(installed.rows.length, 16, `editorial tables present: ${JSON.stringify(installed.rows)}`);
	assertions++;
	covered("editorial-tables-present");

	const owner = await actor("Editorial fixture owner");
	const other = await actor("Editorial fixture other actor");
	const identity = await captureCatalogIdentity("/catalog/resources", owner.cookie, owner, "unit:read");
	assert.equal(identity.hasParticipation, true);
	assertions++;
	covered("resolveIdentity-participation");

	const inputs: { label: string; body: z.input<typeof CreateCatalogResourceSchema> }[] = [
		{ label: "publishing_work", body: { kind: "publishing_work", name: name("Editorial API work") } },
		{
			label: "text_version",
			body: { kind: "text_version", name: name("Editorial API translation"), languageTag: "ja" },
		},
		{
			label: "publication",
			body: { kind: "publication", name: name("Editorial API publication"), pageCount: 240 },
		},
		{ label: "serialization", body: { kind: "serialization", name: name("Editorial API serialization") } },
		{ label: "musical_work", body: { kind: "musical_work", name: name("Editorial API musical work") } },
		{
			label: "recording",
			body: { kind: "recording", name: name("Editorial API recording"), lengthMilliseconds: 120000 },
		},
		{ label: "release_group", body: { kind: "release_group", name: name("Editorial API release group") } },
		{
			label: "music_release",
			body: {
				kind: "music_release",
				name: name("Editorial API physical album"),
				languageTag: "ja",
				scriptCode: "Jpan",
			},
		},
		{
			label: "software_content",
			body: { kind: "software_content", name: name("Editorial API visual novel"), visualNovel: true },
		},
		{ label: "software_release", body: { kind: "software_release", name: name("Editorial API software release") } },
		{
			label: "program",
			body: {
				kind: "program",
				name: name("Editorial API program"),
				structure: { shape: "program", fields: { declaredMainEpisodeCount: 12 } },
			},
		},
		{ label: "entity", body: { kind: "entity", name: name("Editorial API person"), shape: "person" } },
		{
			label: "reference",
			body: {
				kind: "reference",
				name: name("Editorial API place"),
				profile: { shape: "place", address: "Fixture venue" },
			},
		},
		{ label: "grouping", body: { kind: "grouping", name: name("Editorial API franchise") } },
		{ label: "distribution", body: { kind: "distribution", name: name("Editorial API package") } },
	];
	for (const input of inputs) await create(input.label, input.body, owner.cookie);
	const content = created.get("software_content");
	assert.ok(content);
	await create(
		"software_version",
		{
			kind: "software_version",
			name: name("Editorial API version"),
			content: content.reference,
			details: {
				kind: "revision",
				versionLabel: "1.0",
				distinguishingEvidence: "Named revision explicitly supplied by the fixture author",
			},
		},
		owner.cookie,
	);
	const ownersSeen = new Set<string>();
	for (const [label, record] of created) {
		await compactEditorial(record.reference, owner, label);
		ownersSeen.add(record.reference.owner);
	}
	assert.deepEqual([...ownersSeen].toSorted(), [...CatalogOwnerValues].toSorted());
	assertions++;
	covered("all-eight-owners-create-variants");

	const work = created.get("publishing_work");
	assert.ok(work);
	const privateWork = await create(
		"private_work",
		{ kind: "publishing_work", name: name("Editorial private work") },
		owner.cookie,
	);
	await compactEditorial(privateWork.reference, owner, "private_work");
	await request("GET", editorialPath(privateWork.reference, "en"), undefined, 404);
	await request("GET", editorialPath(privateWork.reference, "en"), undefined, 404, other.cookie);
	covered("anonymous-and-other-read-private-404");

	const beforeFence = await editorialSnapshot(work.reference);
	const current = await currentResource(work.reference, owner.cookie);
	const present = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(work.reference, "en"), undefined, 200, owner.cookie)).value,
	);
	await request(
		"PUT",
		editorialPath(work.reference, "en"),
		{
			expectedRevision: current.revision - 1,
			expectedEditorialRevision: present.editorialRevision,
			content: authoredContent("stale owner", "stale owner"),
		},
		409,
		owner.cookie,
	);
	assert.deepEqual(await editorialSnapshot(work.reference), beforeFence);
	assertions++;
	await request(
		"PUT",
		editorialPath(work.reference, "en"),
		{
			expectedRevision: current.revision,
			expectedEditorialRevision: Math.max(0, present.editorialRevision - 1),
			content: authoredContent("stale language", "stale language"),
		},
		409,
		owner.cookie,
	);
	assert.deepEqual(await editorialSnapshot(work.reference), beforeFence);
	assertions++;
	covered("put-fences-owner-and-language-409-atomic");

	const ja = EditorialMutationSchema.parse(
		(
			await request(
				"PUT",
				editorialPath(work.reference, "ja"),
				{
					expectedRevision: current.revision,
					expectedEditorialRevision: 0,
					content: authoredContent("日本語要約", "日本語本文"),
				},
				200,
				owner.cookie,
			)
		).value,
	);
	const enAfterJa = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(work.reference, "en"), undefined, 200, owner.cookie)).value,
	);
	assert.equal(enAfterJa.content?.summary, "publishing_work summary");
	assert.equal(enAfterJa.editorialRevision, present.editorialRevision);
	assertions += 2;
	const languages = EditorialLanguagesSchema.parse(
		(await request("GET", editorialPath(work.reference), undefined, 200, owner.cookie)).value,
	);
	assert.equal(languages.items.length, 2);
	assertions++;
	covered("another-language-retained");

	await request("PUT", editorialPath(work.reference, "en"), {
		expectedRevision: ja.revision,
		expectedEditorialRevision: enAfterJa.editorialRevision,
		content: authoredContent("denied other write", "denied"),
	}, 403, other.cookie);
	await request("GET", `${editorialPath(work.reference, "en")}/history`, undefined, 404, other.cookie);
	covered("other-actor-write-403-history-404");

	await publish(work.reference, owner.cookie, "public");
	const publicRead = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(work.reference, "en"), undefined, 200)).value,
	);
	assert.equal(publicRead.content?.summary, "publishing_work summary");
	assertions++;
	EditorialResponseSchema.parse(
		(await request("GET", editorialPath(work.reference, "en"), undefined, 200, other.cookie)).value,
	);
	await request("PUT", editorialPath(work.reference, "en"), {
		expectedRevision: publicRead.revision,
		expectedEditorialRevision: publicRead.editorialRevision,
		content: authoredContent("public other write", "denied"),
	}, 403, other.cookie);
	covered("anonymous-read-public-other-write-still-403");

	const history = EditorialHistorySchema.parse(
		(await request("GET", `${editorialPath(work.reference, "en")}/history?limit=100`, undefined, 200, owner.cookie)).value,
	);
	assert.ok(history.items.length >= 1);
	assertions++;
	for (const item of history.items) {
		assert.equal("operatorAuthUserId" in item, false);
		assert.equal("snapshot" in item, false);
		assertions += 2;
	}
	covered("history-metadata-no-operator-no-snapshot");
	await request("GET", `${editorialPath(work.reference, "en")}/history`, undefined, 404);
	await request("GET", `${editorialPath(work.reference, "en")}/history`, undefined, 404, other.cookie);
	const firstRevision = history.items.at(-1)?.editorialRevision;
	assert.ok(firstRevision);
	const exact = EditorialResponseSchema.parse(
		(
			await request(
				"GET",
				`${editorialPath(work.reference, "en")}/history/${firstRevision}`,
				undefined,
				200,
				owner.cookie,
			)
		).value,
	);
	assert.equal(exact.editorialRevision, firstRevision);
	assertions++;
	await request(
		"GET",
		`${editorialPath(work.reference, "en")}/history/${firstRevision}`,
		undefined,
		404,
	);
	await request(
		"GET",
		`${editorialPath(work.reference, "en")}/history/${firstRevision}`,
		undefined,
		404,
		other.cookie,
	);
	covered("exact-history-editor-200-public-404");

	const beforeWithdraw = await currentResource(work.reference, owner.cookie);
	const withdrawn = EditorialMutationSchema.parse(
		(
			await request(
				"DELETE",
				editorialPath(work.reference, "en"),
				{
					expectedRevision: beforeWithdraw.revision,
					expectedEditorialRevision: enAfterJa.editorialRevision,
				},
				200,
				owner.cookie,
			)
		).value,
	);
	const withdrawnRead = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(work.reference, "en"), undefined, 200, owner.cookie)).value,
	);
	assert.equal(withdrawnRead.content, null);
	assert.equal(withdrawnRead.editorialRevision, withdrawn.editorialRevision);
	assertions += 2;
	const historyAfterWithdraw = EditorialHistorySchema.parse(
		(await request("GET", `${editorialPath(work.reference, "en")}/history?limit=100`, undefined, 200, owner.cookie)).value,
	);
	assert.ok(historyAfterWithdraw.items.some((item) => item.editorialRevision === withdrawn.editorialRevision));
	assertions++;
	covered("delete-withdraw-retained-revision-history");

	const restored = EditorialMutationSchema.parse(
		(
			await request(
				"POST",
				`${editorialPath(work.reference, "en")}/history/restore`,
				{
					expectedRevision: withdrawn.revision,
					expectedEditorialRevision: withdrawn.editorialRevision,
					historicalRevision: firstRevision,
				},
				200,
				owner.cookie,
			)
		).value,
	);
	assert.ok(restored.editorialRevision > withdrawn.editorialRevision);
	assertions++;
	const restoredRead = EditorialResponseSchema.parse(
		(await request("GET", editorialPath(work.reference, "en"), undefined, 200, owner.cookie)).value,
	);
	assert.equal(restoredRead.content?.summary, exact.content?.summary);
	assert.equal(restoredRead.editorialRevision, restored.editorialRevision);
	assertions += 2;
	covered("restore-old-content-new-revision");

	const ownerRead = await resolveIdentity(
		catalogRequest("GET", editorialPath(work.reference, "en"), undefined, owner.cookie),
		"unit:read",
	);
	assert.ok("participation" in ownerRead);
	await runWithParticipationAuthority(ownerRead.participation, () =>
		database.transaction(async (tx) => {
			const presentations = await readUnitPresentationsInTransaction(tx, [work.reference.id], ["en"]);
			const presentation = presentations.get(work.reference.id);
			assert.ok(presentation);
			assert.equal(presentation.summary, restoredRead.content?.summary ?? exact.content?.summary);
			assertions += 2;
		}),
	);
	covered("presentation-batch-uses-editorial-summary");

	const entity = created.get("entity");
	assert.ok(entity);
	await request("GET", `/catalog/entity/${crypto.randomUUID()}/profile`, undefined, 404, owner.cookie);
	covered("entity-profile-missing-404");
	const existingProfile = EntityProfileResponseSchema.parse(
		(await request("GET", `/catalog/entity/${entity.reference.id}/profile`, undefined, 200, owner.cookie)).value,
	);
	const profileWrite = {
		typeRevisionId: null,
		genderRevisionId: null,
		areaId: null,
		beginAreaId: null,
		endAreaId: null,
		begin: { year: 1990, month: 5, day: 17, text: null },
		end: null,
		ended: false,
	};
	const profileMutation = EntityProfileMutationSchema.parse(
		(
			await request(
				"PUT",
				`/catalog/entity/${entity.reference.id}/profile`,
				{ expectedRevision: existingProfile.revision, profile: profileWrite },
				200,
				owner.cookie,
			)
		).value,
	);
	const writtenProfile = EntityProfileResponseSchema.parse(
		(await request("GET", `/catalog/entity/${entity.reference.id}/profile`, undefined, 200, owner.cookie)).value,
	);
	assert.equal(writtenProfile.profile.begin?.year, 1990);
	assert.equal(writtenProfile.revision, profileMutation.revision);
	assertions += 2;
	const profileHistory = EntityProfileHistorySchema.parse(
		(
			await request(
				"GET",
				`/catalog/entity/${entity.reference.id}/profile/history?limit=100`,
				undefined,
				200,
				owner.cookie,
			)
		).value,
	);
	assert.ok(profileHistory.items.length >= 1);
	assertions++;
	await request("GET", `/catalog/entity/${entity.reference.id}/profile/history`, undefined, 404);
	const removed = EntityProfileMutationSchema.parse(
		(
			await request(
				"DELETE",
				`/catalog/entity/${entity.reference.id}/profile`,
				{ expectedRevision: writtenProfile.revision },
				200,
				owner.cookie,
			)
		).value,
	);
	await request("GET", `/catalog/entity/${entity.reference.id}/profile`, undefined, 404, owner.cookie);
	covered("entity-profile-remove-then-missing-404");
	const restoredProfile = EntityProfileMutationSchema.parse(
		(
			await request(
				"POST",
				`/catalog/entity/${entity.reference.id}/profile/history/restore`,
				{ expectedRevision: removed.revision, historicalRevision: profileMutation.revision },
				200,
				owner.cookie,
			)
		).value,
	);
	const afterRestore = EntityProfileResponseSchema.parse(
		(await request("GET", `/catalog/entity/${entity.reference.id}/profile`, undefined, 200, owner.cookie)).value,
	);
	assert.equal(afterRestore.profile.begin?.year, 1990);
	assert.equal(afterRestore.revision, restoredProfile.revision);
	assertions += 2;
	covered("entity-fixed-profile-put-get-history-remove-restore");

	const capacityWork = await create(
		"capacity_work",
		{ kind: "publishing_work", name: name("Editorial language capacity") },
		owner.cookie,
	);
	const tags = registeredLanguageTags(32);
	assert.equal(tags.length, 32);
	assertions++;
	let capacityRevision = (await currentResource(capacityWork.reference, owner.cookie)).revision;
	for (const [index, language] of tags.entries()) {
		const mutation = EditorialMutationSchema.parse(
			(
				await request(
					"PUT",
					editorialPath(capacityWork.reference, language),
					{
						expectedRevision: capacityRevision,
						expectedEditorialRevision: 0,
						content: authoredContent(`lang ${index}`, `body ${language}`),
					},
					200,
					owner.cookie,
				)
			).value,
		);
		capacityRevision = mutation.revision;
	}
	const capacityList = EditorialLanguagesSchema.parse(
		(await request("GET", editorialPath(capacityWork.reference), undefined, 200, owner.cookie)).value,
	);
	assert.equal(capacityList.items.length, 32);
	assertions++;
	const extraTag = registeredLanguageTags(33).at(-1);
	assert.ok(extraTag && !tags.includes(extraTag));
	await request(
		"PUT",
		editorialPath(capacityWork.reference, extraTag),
		{
			expectedRevision: capacityRevision,
			expectedEditorialRevision: 0,
			content: authoredContent("33rd", "too many"),
		},
		422,
		owner.cookie,
	);
	const afterCap = await editorialSnapshot(capacityWork.reference);
	assert.equal(afterCap.current.length, 32);
	assertions++;
	covered("bound-32-registered-bcp47-languages");

	let privateUseRejected = false;
	for (const tag of ["qaa", "x-private"]) {
		try {
			parseContentLanguageTag(tag);
			unexecuted.push(`private-use-parser-accepted-without-namespace:${tag}`);
		} catch (error) {
			assert.equal(error instanceof Error, true);
			assertions++;
			privateUseRejected = true;
			await request(
				"PUT",
				editorialPath(work.reference, tag),
				{
					expectedRevision: (await currentResource(work.reference, owner.cookie)).revision,
					expectedEditorialRevision: 0,
					content: authoredContent("private", "private"),
				},
				422,
				owner.cookie,
			);
		}
	}
	if (privateUseRejected) covered("private-use-language-rejected-without-namespace");

	const oversized = await create(
		"oversized_work",
		{ kind: "publishing_work", name: name("Editorial oversized reject") },
		owner.cookie,
	);
	const oversizedRevision = (await currentResource(oversized.reference, owner.cookie)).revision;
	const beforeOversize = await editorialSnapshot(oversized.reference);
	await request(
		"PUT",
		editorialPath(oversized.reference, "en"),
		{
			expectedRevision: oversizedRevision,
			expectedEditorialRevision: 0,
			content: { ...authoredContent("x".repeat(501), "body"), summary: "x".repeat(501) },
		},
		422,
		owner.cookie,
	);
	assert.deepEqual(await editorialSnapshot(oversized.reference), beforeOversize);
	assertions++;
	const huge = "h".repeat(513_000);
	await request(
		"PUT",
		editorialPath(oversized.reference, "en"),
		{
			expectedRevision: oversizedRevision,
			expectedEditorialRevision: 0,
			content: authoredContent("ok", huge),
		},
		422,
		owner.cookie,
	);
	assert.deepEqual(await editorialSnapshot(oversized.reference), beforeOversize);
	assertions++;
	covered("oversized-summary-and-json-rejected-without-commit");

	const concurrent = await create(
		"concurrent_work",
		{ kind: "publishing_work", name: name("Editorial concurrent fence") },
		owner.cookie,
	);
	const concurrentRevision = (await currentResource(concurrent.reference, owner.cookie)).revision;
	const [first, second] = await Promise.all([
		api.fetch(
			catalogRequest(
				"PUT",
				editorialPath(concurrent.reference, "en"),
				{
					expectedRevision: concurrentRevision,
					expectedEditorialRevision: 0,
					content: authoredContent("concurrent en", "en"),
				},
				owner.cookie,
			),
		),
		api.fetch(
			catalogRequest(
				"PUT",
				editorialPath(concurrent.reference, "ja"),
				{
					expectedRevision: concurrentRevision,
					expectedEditorialRevision: 0,
					content: authoredContent("concurrent ja", "ja"),
				},
				owner.cookie,
			),
		),
	]);
	const statuses = [first.status, second.status].toSorted();
	assert.ok(statuses.includes(200));
	assert.ok(statuses.includes(409));
	assertions += 2;
	const concurrentCount = (await editorialSnapshot(concurrent.reference)).current.length;
	assert.equal(concurrentCount, 1);
	assertions++;
	covered("concurrent-owner-fence-one-commit");

	const sqlTarget = CatalogEditorialTables.publishing;
	const sqlRef = capacityWork.reference;
	const [head] = await database
		.select({ language: sqlTarget.current.language, revision: sqlTarget.current.revision })
		.from(sqlTarget.current)
		.where(eq(sqlTarget.current.ownerId, sqlRef.id))
		.limit(1);
	assert.ok(head);
	const rollback = new Error("rollback editorial sql fixture");
	try {
		await database.transaction(async (tx) => {
			await tx.execute(sql`savepoint editorial_sql`);
			try {
				await tx.execute(
					sql`update ${sqlTarget.current} set revision = ${head.revision + 2} where owner_id = ${sqlRef.id} and language = ${head.language}`,
				);
				throw new Error("current-head revision jump succeeded");
			} catch (error) {
				if (error instanceof Error && error.message === "current-head revision jump succeeded")
					throw error;
				const detail = postgresError(error);
				assert.equal(detail.code, "23514", `revision jump: ${detail.message}`);
				assertions++;
				await tx.execute(sql`rollback to savepoint editorial_sql`);
			}
			await tx.execute(sql`savepoint editorial_history_update`);
			try {
				await tx.execute(
					sql`update ${sqlTarget.history} set snapshot = '{"tampered":true}'::jsonb where owner_id = ${sqlRef.id} and language = ${head.language} and revision = ${head.revision}`,
				);
				throw new Error("history update succeeded");
			} catch (error) {
				if (error instanceof Error && error.message === "history update succeeded") throw error;
				const detail = postgresError(error);
				assert.equal(detail.code, "23514", `history update: ${detail.message}`);
				assertions++;
				await tx.execute(sql`rollback to savepoint editorial_history_update`);
			}
			await tx.execute(sql`savepoint editorial_history_delete`);
			try {
				await tx.execute(
					sql`delete from ${sqlTarget.history} where owner_id = ${sqlRef.id} and language = ${head.language} and revision = ${head.revision}`,
				);
				throw new Error("history delete succeeded");
			} catch (error) {
				if (error instanceof Error && error.message === "history delete succeeded") throw error;
				const detail = postgresError(error);
				assert.equal(detail.code, "23514", `history delete: ${detail.message}`);
				assertions++;
				await tx.execute(sql`rollback to savepoint editorial_history_delete`);
			}
			await tx.execute(sql`savepoint editorial_history_insert`);
			try {
				await tx.execute(
					sql`insert into ${sqlTarget.history}(owner_id, language, revision, snapshot) values (${sqlRef.id}, ${head.language}, ${head.revision + 50}, '{}'::jsonb)`,
				);
				throw new Error("history insert succeeded");
			} catch (error) {
				if (error instanceof Error && error.message === "history insert succeeded") throw error;
				const detail = postgresError(error);
				assert.equal(detail.code, "23514", `history insert: ${detail.message}`);
				assertions++;
				await tx.execute(sql`rollback to savepoint editorial_history_insert`);
			}
			const counted = await tx.execute(
				sql`select count(*)::int as n from ${sqlTarget.current} where owner_id = ${sqlRef.id}`,
			);
			assert.equal(z.object({ n: z.number() }).parse(counted.rows[0]).n, 32);
			assertions++;
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	covered("sql-immutable-history-and-revision-jump-23514");

	const exactPlan = await database.execute(
		sql`explain (format json, costs true) select owner_id, language, revision, summary from ${sqlTarget.current} where owner_id = ${sqlRef.id} and language = ${head.language} limit 1`,
	);
	const historyPlan = await database.execute(
		sql`explain (format json, costs true) select revision, created_at from ${sqlTarget.history} where owner_id = ${sqlRef.id} and language = ${head.language} and revision < ${head.revision + 1} order by revision desc limit 26`,
	);
	const languagesPlan = await database.execute(
		sql`explain (format json, costs true) select language, revision, state from ${sqlTarget.current} where owner_id = ${sqlRef.id} order by language limit 32`,
	);
	const partitionShape = await database.execute(sql`
		select c.relname, c.relkind, p.partstrat, pg_get_partkeydef(c.oid) as partkey,
			(select count(*) from pg_inherits i where i.inhparent = c.oid) as child_count
		from pg_class c
		join pg_namespace n on n.oid = c.relnamespace
		left join pg_partitioned_table p on p.partrelid = c.oid
		where n.nspname = 'public' and c.relname in ('publishing_editorial','publishing_editorial_revision')
		order by c.relname
	`);
	explainPlans.push({
		exactLanguage: exactPlan.rows,
		historyKeyset: historyPlan.rows,
		boundedLanguages: languagesPlan.rows,
		partitionShape: partitionShape.rows,
	});
	covered("explain-exact-language-history-keyset-bounded-languages");

	unexecuted.push(
		"image-asset-editorial: createImageAsset requires a ready ownership writer plus object storage; S3 fixture endpoint is not a ready writer. Did not attach an ad hoc invalid asset.",
	);

	console.log(
		JSON.stringify({
			check: "catalog-editorial-api",
			assertions,
			coverage,
			unexecuted,
			owners: [...ownersSeen],
			createdResources: created.size,
			atlas: `${target.hostname}:${target.port}${target.pathname}`,
			explain: explainPlans,
			committedToDisposableTarget: true,
		}),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
