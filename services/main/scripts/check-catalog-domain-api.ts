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
	SoftwareReleaseSummarySchema,
	SoftwareDetailSchema,
	SoftwareMutationSchema,
	SoftwareComponentMutationSchema,
	SoftwareComponentSchema,
	SoftwareContextSchema,
	SoftwareCreditSchema,
	SoftwareDetailHistorySchema,
	SoftwareComponentHistorySchema,
	softwarePage,
} from "../src/services/catalog/software-api-contracts";
import {
	ProgramDetailsSchema,
	ProgramMutationSchema,
	ProgramOccurrenceSchema,
	ProgramHistorySchema,
	programPage,
} from "../src/services/catalog/program-api-contracts";

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
	service: { name: "rezics-domain-api-fixture", version: "1.0.0", environment: "tooling" },
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: catalog } = await import("../src/services/api/catalog");
const { default: software } = await import("../src/services/api/catalog/software");
const { default: program } = await import("../src/services/api/catalog/program");
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" })
	.use(errors)
	.use(catalog)
	.group("/catalog", (app) => app.use(software).use(program));
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
	const content = await create(
		{ kind: "software_content", name: name("Source-free software"), visualNovel: true },
		owner,
	);
	const c = `/software/${content.reference.id}`;
	await request("GET", `${c}/details`, undefined, 404);
	await request("GET", `${c}/details`, undefined, 404, other);
	let softwareDetail = SoftwareDetailSchema.parse(
		await request("GET", `${c}/details`, undefined, 200, owner),
	);
	const edit = {
		expectedRevision: softwareDetail.revision,
		details: {
			kind: "content",
			value: {
				originalLanguageTag: "ja",
				developmentStatus: "finished",
				description: "Readable native description",
			},
		},
	};
	SoftwareMutationSchema.parse(await request("PUT", `${c}/details`, edit, 200, owner));
	await request("PUT", `${c}/details`, edit, 409, owner);
	softwareDetail = SoftwareDetailSchema.parse(
		await request("GET", `${c}/details`, undefined, 200, owner),
	);
	assert.equal(
		softwareDetail.details.kind === "content" && softwareDetail.details.value.description,
		"Readable native description",
	);
	assertions++;
	await request("GET", `${c}/history`, undefined, 404, other);
	const history = softwarePage(SoftwareDetailHistorySchema).parse(
		await request("GET", `${c}/history?limit=1`, undefined, 200, owner),
	);
	assert.ok(history.nextCursor);
	assertions++;
	const older = softwarePage(SoftwareDetailHistorySchema).parse(
		await request(
			"GET",
			`${c}/history?limit=1&cursor=${history.nextCursor}`,
			undefined,
			200,
			owner,
		),
	);
	const initial = older.items[0];
	assert.ok(initial);
	await request(
		"POST",
		`${c}/history/restore`,
		{ expectedRevision: softwareDetail.revision, historicalRevision: initial.revision },
		200,
		owner,
	);
	const release = await create({ kind: "software_release", name: name("Native release") }, owner),
		r = `/software/${release.reference.id}`,
		componentId = crypto.randomUUID();
	let releaseDetail = SoftwareDetailSchema.parse(
		await request("GET", `${r}/details`, undefined, 200, owner),
	);
	const createdComponent = SoftwareComponentMutationSchema.parse(
		await request(
			"PUT",
			`${r}/components/language/${componentId}`,
			{
				expectedRevision: releaseDetail.revision,
				expectedComponentRevision: null,
				value: {
					kind: "language",
					languageTag: "ja",
					main: true,
					title: "作品",
					machineTranslated: false,
				},
			},
			200,
			owner,
		),
	);
	const components = softwarePage(SoftwareComponentSchema).parse(
		await request("GET", `${r}/components/language?limit=1`, undefined, 200, owner),
	);
	assert.equal(components.items[0]?.revision, createdComponent.componentRevision);
	assertions++;
	await request(
		"PUT",
		`${r}/components/medium/${crypto.randomUUID()}`,
		{
			expectedRevision: createdComponent.revision,
			expectedComponentRevision: null,
			value: { kind: "language", languageTag: "en" },
		},
		422,
		owner,
	);
	const removed = SoftwareComponentMutationSchema.parse(
		await request(
			"DELETE",
			`${r}/components/language/${componentId}`,
			{
				expectedRevision: createdComponent.revision,
				expectedComponentRevision: createdComponent.componentRevision,
			},
			200,
			owner,
		),
	);
	assert.equal(
		softwarePage(SoftwareComponentSchema).parse(
			await request("GET", `${r}/components/language`, undefined, 200, owner),
		).items.length,
		0,
	);
	assertions++;
	const componentHistory = softwarePage(SoftwareComponentHistorySchema).parse(
		await request("GET", `${r}/components/language/${componentId}/history`, undefined, 200, owner),
	);
	assert.equal(componentHistory.items.length, 2);
	assertions++;
	await request(
		"POST",
		`${r}/components/language/${componentId}/restore`,
		{
			expectedRevision: removed.revision,
			expectedComponentRevision: removed.componentRevision,
			historicalRevision: createdComponent.componentRevision,
		},
		200,
		owner,
	);
	const group = SoftwareContextSchema.parse(
		await request(
			"POST",
			`${c}/contexts`,
			{ value: { label: "English credits", languageTag: "en", state: "active" } },
			200,
			owner,
		),
	);
	const changedGroup = SoftwareContextSchema.parse(
		await request(
			"PUT",
			`${c}/contexts/${group.id}`,
			{ expectedRevision: group.revision, value: { ...group.value, label: "Revised credits" } },
			200,
			owner,
		),
	);
	await request(
		"PUT",
		`${c}/contexts/${group.id}`,
		{ expectedRevision: group.revision, value: group.value },
		409,
		owner,
	);
	await request(
		"POST",
		`${c}/contexts/${group.id}/restore`,
		{ expectedRevision: changedGroup.revision, historicalRevision: group.revision },
		200,
		owner,
	);
	const creditedEntity = await create(
		{ kind: "entity", name: name("Credited person"), shape: "person" },
		owner,
	);
	const role = await database.transaction((tx) =>
		ensureCatalogDefinition(tx, {
			namespace: "catalog.participation_role",
			key: "staff",
			kind: "vocabulary",
			valueKind: null,
		}),
	);
	const restoredGroup = SoftwareContextSchema.parse(
		await request("GET", `${c}/contexts/${group.id}`, undefined, 200, owner),
	);
	const creditValue = {
		entityId: creditedEntity.reference.id,
		name: null,
		context: { id: group.id, revision: restoredGroup.revision },
		characterId: null,
		roleRevisionId: role.revisionId,
		note: "Initial credit",
		state: "active",
	};
	const createdCredit = SoftwareCreditSchema.parse(
		await request("POST", `${c}/credits`, { value: creditValue }, 200, owner),
	);
	const editedCredit = SoftwareCreditSchema.parse(
		await request(
			"PUT",
			`${c}/credits/${createdCredit.id}`,
			{
				expectedRevision: createdCredit.revision,
				value: { ...creditValue, note: "Edited credit" },
			},
			200,
			owner,
		),
	);
	await request(
		"PUT",
		`${c}/credits/${createdCredit.id}`,
		{ expectedRevision: createdCredit.revision, value: creditValue },
		409,
		owner,
	);
	const restoredCredit = SoftwareCreditSchema.parse(
		await request(
			"POST",
			`${c}/credits/${createdCredit.id}/restore`,
			{ expectedRevision: editedCredit.revision, historicalRevision: createdCredit.revision },
			200,
			owner,
		),
	);
	assert.equal(restoredCredit.value.note, "Initial credit");
	assertions++;
	assert.equal(
		softwarePage(SoftwareCreditSchema).parse(
			await request("GET", `${c}/credits`, undefined, 200, owner),
		).items.length,
		1,
	);
	assertions++;
	const version = await create(
		{
			kind: "software_version",
			name: name("Recorded revision"),
			content: content.reference,
			details: {
				kind: "revision",
				versionLabel: "1.0",
				distinguishingEvidence: "Explicit fixture revision",
			},
		},
		owner,
	);
	const versionValue = SoftwareDetailSchema.parse(
		await request("GET", `/software/${version.reference.id}/details`, undefined, 200, owner),
	);
	assert.equal(versionValue.contentId, content.reference.id);
	assertions++;
	releaseDetail = SoftwareDetailSchema.parse(
		await request("GET", `${r}/details`, undefined, 200, owner),
	);
	const animation = SoftwareComponentMutationSchema.parse(
		await request(
			"PUT",
			`${r}/components/animation/story_sprite`,
			{
				expectedRevision: releaseDetail.revision,
				expectedComponentRevision: null,
				value: {
					kind: "animation",
					context: "story_sprite",
					state: "animated",
					handDrawn: true,
					frequency: "all",
				},
			},
			200,
			owner,
		),
	);
	assert.equal(
		softwarePage(SoftwareComponentSchema).parse(
			await request("GET", `${r}/components/animation`, undefined, 200, owner),
		).items.length,
		1,
	);
	assertions++;
	await request(
		"PUT",
		`${r}/components/content/${crypto.randomUUID()}`,
		{
			expectedRevision: animation.revision,
			expectedComponentRevision: null,
			value: { kind: "content", contentId: content.reference.id, versionId: version.reference.id },
		},
		200,
		owner,
	);
	const matchingReleases = softwarePage(SoftwareReleaseSummarySchema).parse(
		await request("GET", `${c}/releases?languageTag=ja`, undefined, 200, owner),
	);
	assert.equal(matchingReleases.items[0]?.name?.value, "Native release");
	assertions++;
	await request("GET", `${c}/contexts?cursor=AAAA`, undefined, 422, owner);
	const p = await create(
			{
				kind: "program",
				name: name("Native program"),
				structure: { shape: "program", fields: { declaredMainEpisodeCount: 12 } },
			},
			owner,
		),
		path = `/program/${p.reference.id}`;
	let programDetail = ProgramDetailsSchema.parse(
		await request("GET", `${path}/details`, undefined, 200, owner),
	);
	const prior = programDetail;
	await request(
		"PUT",
		`${path}/details`,
		{
			expectedRevision: programDetail.revision,
			expectedHistoryId: programDetail.historyId,
			structure: { shape: "program", fields: { declaredMainEpisodeCount: 13 } },
		},
		200,
		owner,
	);
	programDetail = ProgramDetailsSchema.parse(
		await request("GET", `${path}/details`, undefined, 200, owner),
	);
	await request(
		"PUT",
		`${path}/details`,
		{
			expectedRevision: programDetail.revision,
			expectedHistoryId: prior.historyId,
			structure: { shape: "program", fields: { declaredMainEpisodeCount: 14 } },
		},
		409,
		owner,
	);
	await request(
		"POST",
		`${path}/history/program_work/${p.reference.id}/restore`,
		{
			expectedRevision: programDetail.revision,
			expectedHistoryId: programDetail.historyId,
			historyId: prior.historyId,
		},
		200,
		owner,
	);
	const episode = await create(
		{
			kind: "program",
			name: name("Episode one"),
			structure: { shape: "episode", fields: { programId: p.reference.id, episodeNumber: 1 } },
		},
		owner,
	);
	programDetail = ProgramDetailsSchema.parse(
		await request("GET", `${path}/details`, undefined, 200, owner),
	);
	const occurrenceId = crypto.randomUUID();
	const occurrence = ProgramMutationSchema.parse(
		await request(
			"PUT",
			`${path}/occurrences/${occurrenceId}`,
			{
				expectedRevision: programDetail.revision,
				expectedHistoryId: null,
				value: { episodeId: episode.reference.id, position: "a0", sourceNumber: "1" },
			},
			200,
			owner,
		),
	);
	const occurrences = programPage(ProgramOccurrenceSchema).parse(
		await request("GET", `${path}/occurrences?limit=1`, undefined, 200, owner),
	);
	assert.equal(occurrences.items[0]?.name?.value, "Episode one");
	assertions++;
	assert.equal(occurrences.items[0]?.historyId, occurrence.historyId);
	assertions++;
	const deleted = ProgramMutationSchema.parse(
		await request(
			"DELETE",
			`${path}/occurrences/${occurrenceId}`,
			{ expectedRevision: occurrence.revision, expectedHistoryId: occurrence.historyId },
			200,
			owner,
		),
	);
	await request(
		"POST",
		`${path}/history/program_episode_occurrence/${occurrenceId}/restore`,
		{
			expectedRevision: deleted.revision,
			expectedHistoryId: deleted.historyId,
			historyId: occurrence.historyId,
		},
		200,
		owner,
	);
	const programHistory = programPage(ProgramHistorySchema).parse(
		await request(
			"GET",
			`${path}/history/program_work/${p.reference.id}?limit=1`,
			undefined,
			200,
			owner,
		),
	);
	assert.ok(programHistory.nextCursor);
	assertions++;
	await request(
		"GET",
		`${path}/history/program_episode/${episode.reference.id}?cursor=${programHistory.nextCursor}`,
		undefined,
		422,
		owner,
	);
	await request("GET", `${path}/history/program_work/${p.reference.id}`, undefined, 404, other);
	await request(
		"PATCH",
		`/resources/program/${episode.reference.id}/lifecycle`,
		{
			expectedRevision: episode.revision,
			status: "published",
			visibility: "public",
			contentRating: "general",
		},
		200,
		owner,
	);
	const otherProgram = await create(
		{
			kind: "program",
			name: name("Other editor program"),
			structure: { shape: "program", fields: {} },
		},
		other,
	);
	const otherOccurrenceId = crypto.randomUUID(),
		otherPath = `/program/${otherProgram.reference.id}`;
	const otherPlacement = ProgramMutationSchema.parse(
		await request(
			"PUT",
			`${otherPath}/occurrences/${otherOccurrenceId}`,
			{
				expectedRevision: otherProgram.revision,
				expectedHistoryId: null,
				value: { episodeId: episode.reference.id, position: "a0", sourceNumber: "Visible once" },
			},
			200,
			other,
		),
	);
	const episodeCurrent = ProgramDetailsSchema.parse(
		await request("GET", `/program/${episode.reference.id}/details`, undefined, 200, owner),
	);
	await request(
		"PATCH",
		`/resources/program/${episode.reference.id}/lifecycle`,
		{
			expectedRevision: episodeCurrent.revision,
			status: "published",
			visibility: "private",
			contentRating: "general",
		},
		200,
		owner,
	);
	assert.equal(
		programPage(ProgramHistorySchema).parse(
			await request(
				"GET",
				`${otherPath}/history/program_episode_occurrence/${otherOccurrenceId}`,
				undefined,
				200,
				other,
			),
		).items.length,
		0,
	);
	assertions++;
	await request(
		"POST",
		`${otherPath}/history/program_episode_occurrence/${otherOccurrenceId}/restore`,
		{
			expectedRevision: otherPlacement.revision,
			expectedHistoryId: otherPlacement.historyId,
			historyId: otherPlacement.historyId,
		},
		404,
		other,
	);
	console.log(
		JSON.stringify({ check: "catalog-domain-api", assertions, committedToDisposableTarget: true }),
	);
} finally {
	if (accounts.length) await database.delete(sessions).where(inArray(sessions.userId, accounts));
	await database.$client.end();
	await observability.shutdown();
}
