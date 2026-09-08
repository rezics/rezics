import { planMusicBrainzDependencies } from "../src/services/catalog/musicbrainz-dependencies";
import { MUSIC_SOURCE_DEPENDENCY_LIMIT } from "../src/services/database/schema/catalog-source-limits";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Readable } from "node:stream";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import { authEntity } from "../src/services/database/schema/participation";
import { operationalCapacity, operationalOutbox } from "../src/services/database/schema/operational-durability";
import { catalogSourceMappingClaim, catalogSourceProposalDependency } from "../src/services/database/schema";
import { musicTrackOccurrence, musicComponentRevision, musicComponentSourceOccurrence } from "../src/services/database/schema/catalog-music";
import { catalogSourceSnapshotBundle, catalogSourceSnapshotPart } from "../src/services/database/schema/catalog-source-multipart";
import { musicReleaseSourceJob } from "../src/services/database/schema/catalog-music-source-job";
import { MusicBrainzCatalogContractSha256, type MusicBrainzRelease } from "../src/services/catalog/musicbrainz";
import { recordCatalogSourceDocument, recordCatalogSourceObservation, storeCatalogSourcePayload, storeCatalogSourceMultipartPayload, catalogSourceRecordId, type CatalogSourceArchive } from "../src/services/catalog/source-observations";
import { MusicBrainzReleaseBundleProfile, MusicBrainzReleaseBundleDerivationSha256, musicBrainzReleaseAcquisitionProfiles, normalizeMusicBrainzReleaseBundle } from "../src/services/catalog/musicbrainz-release-bundle";
import { SOURCE_DOCUMENT_BYTE_LIMIT } from "../src/services/database/schema/catalog-source-limits";
import { catalogSourceRecord } from "../src/services/database/schema/catalog-source";
import { aggregateRoutingBucket, eventEnvelopeSchema, type EventEnvelope } from "../src/services/events/envelope";
import { proposeCatalogSourceAdoption } from "../src/services/catalog/source-proposals";
import { readCatalogSourceApplication } from "../src/services/catalog/source-applications";
import { enqueueMusicReleaseSourceIntakeJob, enqueueMusicReleaseSourceJob, controlMusicReleaseSourceJob, readMusicReleaseSourceJob, createMusicReleaseSourceHandlers } from "../src/services/catalog/music-release-source-jobs";
import { runWithNativeFixtureActor } from "./native-fixture-actor";
import { currentParticipationAuthority, ParticipationAuthoritySchema, runWithParticipationAuthority } from "../src/services/participation/policy";
import type { StreamRoute } from "../src/services/events/topology";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1") throw new Error("Explicit disposable fixture configuration required");
const target = new URL(connectionString);
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || target.port !== (process.env.REZICS_CATALOG_FIXTURE_PORT ?? "25434") || target.port === "15432" || target.pathname !== `/${process.env.REZICS_CATALOG_FIXTURE_DATABASE ?? "rezics_atlas"}`) throw new Error("Music release jobs require the isolated Atlas fixture");
const pool = new Pool({ connectionString, max: 3, statement_timeout: 20000 });
const db = drizzle({ client: pool });
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) { objects.set(input.Key, new Uint8Array(input.Body)); },
	async get(input) { const bytes = objects.get(input.Key); return { Body: bytes ? Readable.from([bytes]) : undefined }; },
};
const captureDirectory = process.env.REZICS_MUSIC_RELEASE_BUNDLE_DIRECTORY;
async function readCapturedPart(key: "tracks" | "media" | "metadata") {
	assert.ok(captureDirectory);
	const path = resolve(captureDirectory, `${key}.json`);
	assert.ok((await stat(path)).size <= SOURCE_DOCUMENT_BYTE_LIMIT);
	return new Uint8Array(await readFile(path));
}
const captured = captureDirectory ? { tracks: await readCapturedPart("tracks"), media: await readCapturedPart("media"), metadata: await readCapturedPart("metadata") } : null;
const capture = captureDirectory ? z.strictObject({ id: z.uuid(), profiles: z.array(z.strictObject({ key: z.enum(["tracks", "media", "metadata"]), profile: z.string(), requestUrl: z.url(), observedAt: z.iso.datetime({ offset: true }) })).length(3), hashes: z.array(z.strictObject({ profile: z.enum(["tracks", "media", "metadata"]), bytes: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/u) })).length(3) }).parse(JSON.parse(await readFile(resolve(captureDirectory, "capture.json"), "utf8"))) : null;
if (captured && capture) for (const profile of musicBrainzReleaseAcquisitionProfiles(capture.id)) {
	const receipt = capture.profiles.find((candidate) => candidate.key === profile.key), hash = capture.hashes.find((candidate) => candidate.profile === profile.key);
	assert.ok(receipt && hash);
	assert.equal(receipt.requestUrl, profile.url); assert.equal(receipt.profile, profile.profile);
	assert.equal(captured[profile.key].byteLength, hash.bytes);
	assert.equal(createHash("sha256").update(captured[profile.key]).digest("hex"), hash.sha256);
}
const capturedMetadata: unknown = captured ? JSON.parse(new TextDecoder().decode(captured.metadata)) : null;
const capturedId = capturedMetadata !== null && typeof capturedMetadata === "object" && "id" in capturedMetadata ? capturedMetadata.id : null;
assert.ok(!captured || typeof capturedId === "string");
const sourceKey = { source: "musicbrainz", objectType: "release", externalId: typeof capturedId === "string" ? capturedId : crypto.randomUUID() };
if (capture) assert.equal(capture.id, sourceKey.externalId);
const capturedNative = captured ? normalizeMusicBrainzReleaseBundle(sourceKey.externalId, captured).document : null;
const sourceRecordId = catalogSourceRecordId(sourceKey);
const bucket = aggregateRoutingBucket("source_record", sourceRecordId);
const route: StreamRoute = { class: "task", epoch: 1, bucket, maxBytes: 64_000_000, maxMessages: 1000, maxConsumers: 16, deployment: "qualification" };
const handlers = createMusicReleaseSourceHandlers(db, route, async () => { throw new Error("Unexpected task disposal"); }, archive);
let sequence = 0;
async function deliver(envelope: EventEnvelope) {
	const handler = handlers.find((candidate) => candidate.kind === envelope.kind);
	assert.ok(handler);
	return handler.apply({ envelope, payload: handler.parsePayload(envelope.payload), signal: AbortSignal.timeout(30000),
		delivery: { stream: "fixture", consumer: handler.durable, sequence: ++sequence, deliveryCount: 1, payloadSha256: "0".repeat(64) } });
}
async function message(jobId: string, generation: number, position: number, phase: "prepare" | "publish") {
	const [row] = await db.select({ payload: operationalOutbox.payload }).from(operationalOutbox)
		.where(and(eq(operationalOutbox.routingBucket, bucket), eq(operationalOutbox.kind, `source.music_release.${phase}`),
			sql`${operationalOutbox.payload}->'payload'->>'jobId'=${jobId}`,
			sql`(${operationalOutbox.payload}->'payload'->>'generation')::bigint=${generation}`,
			sql`(${operationalOutbox.payload}->'payload'->>'afterPosition')::integer=${position}`))
		.orderBy(operationalOutbox.createdAt.desc()).limit(1);
	assert.ok(row);
	return eventEnvelopeSchema.parse(row.payload);
}
try {
	assert.equal((await db.select({ id: catalogSourceRecord.id }).from(catalogSourceRecord).where(eq(catalogSourceRecord.id, sourceRecordId)).limit(1)).length, 0, "Fixture source must not already exist; use a fresh qualification database");
	const admission = await db.transaction(async (tx) => {
		const [actor] = await tx.insert(users).values({ name: "Music release job fixture", email: `${crypto.randomUUID()}@example.invalid` }).returning({ id: users.id });
		assert.ok(actor);
		await tx.insert(operationalCapacity).values(["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({ routingBucket: bucket, lane, maximumRows: 10000n, maximumBytes: 128_000_000n }))).onConflictDoNothing();
		return runWithNativeFixtureActor(tx, actor.id, async () => ({ actor: actor.id, authority: ParticipationAuthoritySchema.parse(currentParticipationAuthority()) }));
	});
	const asActor = <T>(work: () => Promise<T>) => runWithParticipationAuthority(admission.authority, work);
	const status = (jobId: string) => asActor(() => db.transaction((tx) => readMusicReleaseSourceJob(tx, admission.actor, { sourceRecordId, jobId })));
	const control = (jobId: string, action: "pause" | "resume") => asActor(() => db.transaction((tx) => controlMusicReleaseSourceJob(tx, admission.actor, { sourceRecordId, jobId, action })));
	async function advance(jobId: string, stopPrepared = false) {
		for (let count = 0; count < 300; count++) {
			const job = await status(jobId);
			if (["succeeded", "failed", "blocked", "superseded", "paused"].includes(job.state) || (stopPrepared && job.prepared)) return job;
			const [raw] = await db.select().from(musicReleaseSourceJob).where(and(eq(musicReleaseSourceJob.sourceRecordId, sourceRecordId), eq(musicReleaseSourceJob.id, jobId))).limit(1);
			assert.ok(raw);
			const outcome = await deliver(await message(jobId, raw.generation, raw.nextDependencyPosition, raw.preparationComplete ? "publish" : "prepare"));
			assert.notEqual(outcome.status, "retry", JSON.stringify(outcome));
		}
		throw new Error("Fixture exceeded its bounded job steps");
	}
	const count = capturedNative?.media.reduce((sum, medium) => sum + (medium.tracks?.length ?? 0), 0) ?? Number(process.env.REZICS_MUSIC_RELEASE_JOB_TRACKS ?? 260);
	const mediumCount = capturedNative?.media.length ?? Number(process.env.REZICS_MUSIC_RELEASE_JOB_MEDIA ?? 1);
	assert.ok(Number.isSafeInteger(count) && count >= 260 && count <= 8000);
	assert.ok(Number.isSafeInteger(mediumCount) && mediumCount >= 1 && mediumCount <= Math.min(count, 1000));
	const credit = [{ artist: { id: crypto.randomUUID(), name: "Fixture orchestra", type: "Orchestra" }, name: "Fixture orchestra", joinphrase: "" }];
	const physical = Math.ceil(count / mediumCount) <= 99;
	const original: MusicBrainzRelease = capturedNative ?? { id: sourceKey.externalId, title: "Large staged fixture", barcode: "before", "artist-credit": credit,
		media: Array.from({ length: mediumCount }, (_, mediumIndex) => {
			const start = Math.floor(mediumIndex * count / mediumCount), end = Math.floor((mediumIndex + 1) * count / mediumCount);
			return { id: crypto.randomUUID(), position: mediumIndex + 1,
				...(physical ? { format: "CD", discs: [{ id: crypto.randomUUID().replaceAll("-", "").slice(0, 28), "offset-count": end - start, offsets: Array.from({ length: end - start }, (_, index) => 150 + index * 15000), sectors: 150 + (end - start) * 15000 }] } : {}), tracks: Array.from({ length: end - start }, (_, index) => ({ id: crypto.randomUUID(), title: `Original ${start + index}`, "artist-credit": credit, number: String(index + 1), position: index + 1, recording: { id: crypto.randomUUID(), title: `Recording ${start + index}` } })) };
		}) };

	async function observe(document: MusicBrainzRelease) {
		if (captureDirectory || process.env.REZICS_MUSIC_RELEASE_MULTIPART === "1") {
			const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
			const { media: _media, ...metadata } = document;
			// Only the first capture is live evidence. Later documents deliberately simulate upstream edits.
			const raw = captured && document === original ? captured : { tracks: encode(document), media: encode(document), metadata: encode(metadata) };
			const normalized = normalizeMusicBrainzReleaseBundle(sourceKey.externalId, raw);
			const profiles = musicBrainzReleaseAcquisitionProfiles(sourceKey.externalId);
			const observedAt = new Date().toISOString();
			const parts = profiles.map((profile) => ({ key: profile.key, profile: profile.profile, kind: "upstream_response" as const, bytes: raw[profile.key], requestUrl: profile.url,
				observedAt: captured && document === original ? capture!.profiles.find((item) => item.key === profile.key)!.observedAt : observedAt }));
			const receipt = await storeCatalogSourceMultipartPayload(sourceKey, MusicBrainzReleaseBundleProfile, MusicBrainzReleaseBundleDerivationSha256,
				[...parts, { key: "native_view", profile: MusicBrainzReleaseBundleProfile, kind: "derived_view", bytes: normalized.bytes, requestUrl: null, observedAt }], MusicBrainzCatalogContractSha256, archive);
			return db.transaction((tx) => recordCatalogSourceObservation(tx, receipt));
		}
		const bytes = new TextEncoder().encode(JSON.stringify(document));
		const receipt = await storeCatalogSourcePayload(sourceKey, bytes, MusicBrainzCatalogContractSha256, null, archive);
		return db.transaction((tx) => recordCatalogSourceDocument(tx, receipt, bytes));
	}
	const expectedDependencies = planMusicBrainzDependencies("release", original, MUSIC_SOURCE_DEPENDENCY_LIMIT).length;
	const first = await observe(original);
	if (captureDirectory || process.env.REZICS_MUSIC_RELEASE_MULTIPART === "1") {
		const headers = await db.select().from(catalogSourceSnapshotBundle).where(and(eq(catalogSourceSnapshotBundle.sourceRecordId, sourceRecordId), eq(catalogSourceSnapshotBundle.snapshotId, first.snapshot.id))).limit(1);
		const parts = await db.select().from(catalogSourceSnapshotPart).where(and(eq(catalogSourceSnapshotPart.sourceRecordId, sourceRecordId), eq(catalogSourceSnapshotPart.snapshotId, first.snapshot.id))).limit(5);
		assert.equal(headers[0]?.partCount, 4); assert.equal(parts.length, 4);
		assert.equal(parts.filter((part) => part.key === "native_view" && part.kind === "derived_view").length, 1);
		const repeated = await observe(original);
		assert.equal(repeated.snapshot.id, first.snapshot.id, "Changed receipt times alone must not create another snapshot");
	}
	const initial = await asActor(() => db.transaction((tx) => enqueueMusicReleaseSourceIntakeJob(tx, admission.actor, { sourceRecordId, snapshotId: first.snapshot.id })));
	const firstMessage = await message(initial.id, initial.generation, 0, "prepare");
	const paused = await control(initial.id, "pause");
	assert.equal(paused.state, "paused");
	await deliver(firstMessage);
	assert.equal((await status(initial.id)).state, "paused");
	assert.equal((await db.select().from(catalogSourceMappingClaim).where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId)).limit(1)).length, 0);
	await control(initial.id, "resume");
	const staged = await advance(initial.id, true);
	assert.equal(staged.state, "prepared");
	assert.equal(staged.preparedDependencies, expectedDependencies);
	assert.equal(staged.reference, null);
	assert.equal((await db.select().from(catalogSourceMappingClaim).where(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId)).limit(1)).length, 0, "No root is visible during dependency preparation");
	const initialDone = await advance(initial.id);
	assert.equal(initialDone.state, "succeeded");
	assert.ok(initialDone.reference);
	const reference = initialDone.reference;
	if (captureDirectory || process.env.REZICS_MUSIC_RELEASE_MULTIPART === "1") {
		const [wrong] = await db.select({ path: musicComponentSourceOccurrence.sourcePath }).from(musicComponentSourceOccurrence).where(and(eq(musicComponentSourceOccurrence.sourceRecordId, sourceRecordId), eq(musicComponentSourceOccurrence.snapshotId, first.snapshot.id), sql`${musicComponentSourceOccurrence.sourcePath} not like '/parts/native_view%'`)).limit(1);
		assert.equal(wrong, undefined, "All native component evidence points to the actual archived native view");
	}
	const nativeTracks = () => db.select({ id: musicTrackOccurrence.id, name: musicTrackOccurrence.name, position: musicTrackOccurrence.position, mediumId: musicTrackOccurrence.mediumId, artistCreditId: musicTrackOccurrence.artistCreditId, lengthMilliseconds: musicTrackOccurrence.lengthMilliseconds, number: musicTrackOccurrence.number }).from(musicTrackOccurrence).where(eq(musicTrackOccurrence.releaseId, reference.id)).orderBy(musicTrackOccurrence.mediumId, musicTrackOccurrence.position).limit(count + 1);
	const before = await nativeTracks();
	assert.equal(before.length, count);
	const oldIds = new Set(before.map((track) => track.id));
	let updateIndex = 0;
	const incoming: MusicBrainzRelease = { ...original, media: original.media.map((medium) => ({ ...medium, tracks: [...(medium.tracks ?? [])].reverse().map((track, index) => {
		const ordinal = updateIndex++;
		return { ...track, position: index + 1, number: String(index + 1), title: ordinal === 190 ? "Reject publication fixture" : `Updated ${ordinal}` };
	}) })) };

	const second = await observe(incoming);
	const [binding] = await db.select().from(catalogSourceMappingClaim).where(and(eq(catalogSourceMappingClaim.sourceRecordId, sourceRecordId), eq(catalogSourceMappingClaim.path, "/"))).limit(1);
	assert.ok(binding);
	const proposed = await asActor(() => db.transaction((tx) => proposeCatalogSourceAdoption(tx, admission.actor, { sourceRecordId, mappingKey: binding.mappingKey, snapshotId: second.snapshot.id, mappingVersion: "musicbrainz.release.1" })));
	assert.ok("proposal" in proposed && proposed.proposal);
	const proposalId = proposed.proposal.id;
	const appliedJob = await asActor(() => db.transaction((tx) => enqueueMusicReleaseSourceJob(tx, admission.actor, { sourceRecordId, proposalId, action: "apply", reason: "Qualify a multi-page native reorder" })));
	assert.deepEqual(appliedJob.reference, reference);
	await advance(appliedJob.id, true);
	const dependencies = await db.select({ position: catalogSourceProposalDependency.position }).from(catalogSourceProposalDependency).where(and(eq(catalogSourceProposalDependency.sourceRecordId, sourceRecordId), eq(catalogSourceProposalDependency.proposalId, proposalId))).limit(expectedDependencies * 2 + 1);
	assert.equal(dependencies.length, expectedDependencies * 2, "Incoming and compensation references are prepared in their own pages");
	const historyCount = async () => (await db.select({ count: sql<number>`count(*)::integer` }).from(musicComponentRevision).where(eq(musicComponentRevision.ownerId, reference.id)))[0]!.count;
	const historyBefore = await historyCount();
	// The injected trigger is restricted to this newly created fixture owner and is removed below.
	await db.execute(sql`create or replace function public.music_release_job_fixture_failure() returns trigger language plpgsql as $$ begin if NEW.release_id::text=TG_ARGV[0] and NEW.name='Reject publication fixture' then raise exception 'injected music publication failure'; end if; return NEW; end $$`);
	await db.execute(sql`create trigger music_release_job_fixture_failure before update on public.music_track_occurrence for each row execute function public.music_release_job_fixture_failure(${sql.raw(`'${reference.id}'`)})`);
	try {
		const prepared = await status(appliedJob.id);
		const [publishState] = await db.select().from(musicReleaseSourceJob).where(and(eq(musicReleaseSourceJob.sourceRecordId, sourceRecordId), eq(musicReleaseSourceJob.id, appliedJob.id))).limit(1);
		assert.ok(publishState);
		const failedDelivery = await message(appliedJob.id, prepared.generation, publishState.nextDependencyPosition, "publish");
		assert.equal((await deliver(failedDelivery)).status, "retry");
		assert.deepEqual(await nativeTracks(), before, "Failure after earlier native writes rolls back the entire reorder");
		assert.equal(await historyCount(), historyBefore, "Partial histories do not escape the failed publication");
		await control(appliedJob.id, "pause");
	} finally {
		await db.execute(sql`drop trigger if exists music_release_job_fixture_failure on public.music_track_occurrence`);
		await db.execute(sql`drop function if exists public.music_release_job_fixture_failure()`);
	}
	await control(appliedJob.id, "resume");
	const applied = await advance(appliedJob.id);
	assert.equal(applied.state, "succeeded");
	const changed = await nativeTracks();
	assert.equal(changed.length, count);
	assert.ok(changed.every((track) => oldIds.has(track.id)));
	assert.equal(changed[0]!.id, before.filter((track) => track.mediumId === changed[0]!.mediumId).at(-1)!.id);
	const journal = await asActor(() => db.transaction((tx) => readCatalogSourceApplication(tx, admission.actor, { sourceRecordId, proposalId, action: "apply" })));
	assert.ok(journal);
	assert.equal(journal.changes.filter((change) => change.kind === "music-component").length, count);
	const repeated = await asActor(() => db.transaction((tx) => enqueueMusicReleaseSourceJob(tx, admission.actor, { sourceRecordId, proposalId, action: "apply", reason: "Repeat exact admission" })));
	assert.equal(repeated.id, appliedJob.id);
	const withdraw = await asActor(() => db.transaction((tx) => enqueueMusicReleaseSourceJob(tx, admission.actor, { sourceRecordId, proposalId, action: "withdraw", reason: "Qualify exact large compensation" })));
	assert.equal((await advance(withdraw.id)).state, "succeeded");
	assert.deepEqual(await nativeTracks(), before);
	// A large unchanged source now produces a single header mutation instead of failing its whole-source size check.
	const tiny = await observe({ ...original, barcode: "after" });
	const tinyProposal = await asActor(() => db.transaction((tx) => proposeCatalogSourceAdoption(tx, admission.actor, { sourceRecordId, mappingKey: binding.mappingKey, snapshotId: tiny.snapshot.id, mappingVersion: "musicbrainz.release.1" })));
	assert.ok("proposal" in tinyProposal && tinyProposal.proposal);
	const tinyProposalId = tinyProposal.proposal.id;
	const tinyJob = await asActor(() => db.transaction((tx) => enqueueMusicReleaseSourceJob(tx, admission.actor, { sourceRecordId, proposalId: tinyProposalId, action: "apply", reason: "Single change on large snapshot" })));
	await advance(tinyJob.id, true);
	await db.update(authEntity).set({ state: "suspended" }).where(eq(authEntity.authUserId, admission.actor));
	const [tinyRaw] = await db.select().from(musicReleaseSourceJob).where(and(eq(musicReleaseSourceJob.sourceRecordId, sourceRecordId), eq(musicReleaseSourceJob.id, tinyJob.id))).limit(1);
	assert.ok(tinyRaw);
	assert.equal((await deliver(await message(tinyJob.id, tinyRaw.generation, tinyRaw.nextDependencyPosition, "publish"))).status, "terminal");
	await db.update(authEntity).set({ state: "active" }).where(eq(authEntity.authUserId, admission.actor));
	assert.equal((await status(tinyJob.id)).state, "failed");
	await control(tinyJob.id, "resume");
	assert.equal((await advance(tinyJob.id)).state, "succeeded");
	const tinyJournal = await asActor(() => db.transaction((tx) => readCatalogSourceApplication(tx, admission.actor, { sourceRecordId, proposalId: tinyProposalId, action: "apply" })));
	assert.equal(tinyJournal?.changes.filter((change) => change.kind === "music-component").length, 1);
	console.info(JSON.stringify({ status: "passed", tracks: count, media: mediumCount, physical, captureDirectory, sourceEvidence: captured ? "captured initial profiles; simulated update/withdrawal" : "synthetic source fixture", multipart: Boolean(captureDirectory || process.env.REZICS_MUSIC_RELEASE_MULTIPART === "1"), dependencyRows: dependencies.length, initialJobId: initial.id, applyJobId: appliedJob.id,
		checks: ["initial background adoption", "pause before preparation", "260 dependency references paged", "no partial root visibility", "reorder across 128 boundaries", "mid-publication rollback", "resume prepared publication", "complete exact journal", "withdrawal", "revoked authority", "one-change large snapshot"] }));
} finally {
	await pool.end();
}
