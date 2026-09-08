import { planMusicBrainzDependencies, prepareMusicBrainzProposalDependencies } from "./musicbrainz-dependencies";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseExecutor, DatabaseTransaction } from "../database";
import { musicReleaseSourceJob as jobs } from "../database/schema/catalog-music-source-job";
import { catalogSourceAdoptionProposal as proposals, catalogSourceRecord as records } from "../database/schema/catalog-source";
import { catalogSourceApplication as applications } from "../database/schema/catalog-source-application";
import { currentParticipationAuthority, ParticipationAuthoritySchema, ParticipationDenied, requireParticipation, runWithParticipationAuthority } from "../participation/policy";
import { loadCatalogIdentity, CatalogReferenceNotFound } from "./storage";
import { lockCatalogSourceBinding } from "./source-bindings";
import { loadCatalogSourceReceipt, readCatalogSourceBytes, type CatalogSourceArchive } from "./source-observations";
import { MusicBrainzCatalogContractSha256, MusicBrainzReleaseSchema } from "./musicbrainz";
import { preflightMusicBrainzReleaseDelta } from "./musicbrainz-release-plan";
import { AccountAuthorization } from "../authorization/account/authorization";
import { adoptMusicBrainzRelease } from "./musicbrainz-adoption";
import { musicBrainzReleaseNativeWriter } from "./musicbrainz-release-delta";
import { decideCatalogSourceProposal } from "./source-proposals";
import { aggregateRoutingBucket, eventEnvelopeSchema } from "../events/envelope";
import { admitOperationalTask, claimOperationalTask, completeOperationalTask, parseTaskRequest, retryOperationalTask } from "../events/durability";
import type { StreamRoute } from "../events/topology";
import type { EventHandler } from "../events/consumer";

const locatorSchema = z.strictObject({ sourceRecordId: z.uuid(), jobId: z.uuid() });
const inputSchema = z.strictObject({ sourceRecordId: z.uuid(), proposalId: z.uuid(), action: z.enum(["apply", "withdraw"]), reason: z.string().min(1).max(2048) });
const taskSchema = z.strictObject({ afterPosition: z.number().int().min(0).max(8192), sourceRecordId: z.uuid(), jobId: z.uuid(), generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), operationId: z.uuid(), consumerKey: z.enum(["music-release-prepare-v1", "music-release-publish-v1"]), maximumAttempts: z.literal(10), deadline: z.iso.datetime({ offset: true }) });
const preparationSchema = z.strictObject({ beforeSnapshotId: z.uuid(), afterSnapshotId: z.uuid(), beforeSha256: z.string().regex(/^[0-9a-f]{64}$/), afterSha256: z.string().regex(/^[0-9a-f]{64}$/) });
export const MusicReleaseSourceJobSchema = z.strictObject({ id: z.uuid(), sourceRecordId: z.uuid(), proposalId: z.uuid().nullable(), action: z.enum(["initialize", "apply", "withdraw"]), reference: z.strictObject({ owner: z.literal("music"), id: z.uuid() }).nullable(), generation: z.number().int().positive(), state: z.enum(["queued", "prepared", "paused", "succeeded", "superseded", "blocked", "failed"]), prepared: z.boolean(), preparedDependencies: z.number().int().min(0).max(8192), outcomeCode: z.string().nullable() });
function present(row: typeof jobs.$inferSelect) { return MusicReleaseSourceJobSchema.parse({ id: row.id, sourceRecordId: row.sourceRecordId, proposalId: row.proposalId, action: row.action, reference: row.musicId ? { owner: "music", id: row.musicId } : null, generation: row.generation, state: row.state, prepared: row.preparationComplete, preparedDependencies: row.nextDependencyPosition, outcomeCode: row.outcomeCode }); }
function key(input: { sourceRecordId: string; jobId: string }) { return and(eq(jobs.sourceRecordId, input.sourceRecordId), eq(jobs.id, input.jobId)); }

async function authorize(tx: DatabaseTransaction, actor: string, input: { sourceRecordId: string; proposalId: string | null; authority?: z.infer<typeof ParticipationAuthoritySchema> }) {
	if (input.proposalId === null) {
		const authority = await authorizeIntake(tx, actor, input.sourceRecordId);
		if (input.authority?.principal.authUserId !== actor) throw new ParticipationDenied();
		return { proposal: null, binding: null, authority };
	}
	const [proposal] = await tx.select().from(proposals).where(and(eq(proposals.sourceRecordId, input.sourceRecordId), eq(proposals.id, input.proposalId))).limit(1);
	if (!proposal || proposal.mappingVersion !== "musicbrainz.release.1") throw new CatalogReferenceNotFound();
	const binding = await lockCatalogSourceBinding(tx, { sourceRecordId: input.sourceRecordId, mappingKey: proposal.mappingKey });
	if (binding.reference.owner !== "music") throw new CatalogReferenceNotFound();
	const authority = currentParticipationAuthority();
	if (!authority || authority.principal.authUserId !== actor) throw new ParticipationDenied();
	if (authority.grant || authority.principal.kind === "service")
		await requireParticipation(tx, authority, "proposal.adopt", binding.reference, { sourceRecordId: input.sourceRecordId, proposalId: input.proposalId });
	else await loadCatalogIdentity(tx, binding.reference, actor, true);
	return { proposal, binding, authority };
}

async function admitStage(tx: DatabaseTransaction, row: typeof jobs.$inferSelect, phase: "prepare" | "publish") {
	const operationId = crypto.randomUUID();
	await admitOperationalTask(tx, eventEnvelopeSchema.parse({ version: 1, messageId: operationId, class: "task", kind: `source.music_release.${phase}`,
		occurredAt: new Date().toISOString(), correlationId: row.id, causationId: null, routingEpoch: 1,
		routingBucket: aggregateRoutingBucket("source_record", row.sourceRecordId),
		aggregate: { owner: "source_record", key: row.sourceRecordId, revision: String(row.generation) },
		payload: { afterPosition: row.nextDependencyPosition, sourceRecordId: row.sourceRecordId, jobId: row.id, generation: row.generation, operationId,
			consumerKey: `music-release-${phase}-v1`, maximumAttempts: 10, deadline: new Date(Date.now() + 86_400_000).toISOString() },
	}));
}


async function authorizeIntake(tx: DatabaseTransaction, actor: string, sourceRecordId: string) {
	const authority = currentParticipationAuthority();
	if (!authority || authority.principal.kind !== "auth" || authority.principal.authUserId !== actor || authority.grant) throw new ParticipationDenied("Source intake requires a current direct account");
	await requireParticipation(tx, authority, "entity.security", { owner: "entity", id: authority.actingEntityId });
	await new AccountAuthorization(actor).ensureCanContribute(tx);
	const [source] = await tx.select().from(records).where(eq(records.id, sourceRecordId)).limit(1).for("update");
	if (!source || source.source !== "musicbrainz" || source.objectType !== "release") throw new CatalogReferenceNotFound();
	return authority;
}

/** @alpha Initial release adoption also runs outside the HTTP request. Supporting references use its admitted direct authority. */
export async function enqueueMusicReleaseSourceIntakeJob(tx: DatabaseTransaction, actor: string, input: { sourceRecordId: string; snapshotId: string }) {
	const value = z.strictObject({ sourceRecordId: z.uuid(), snapshotId: z.uuid() }).parse(input);
	const authority = await authorizeIntake(tx, actor, value.sourceRecordId);
	const [prior] = await tx.select().from(jobs).where(and(eq(jobs.sourceRecordId, value.sourceRecordId), eq(jobs.snapshotId, value.snapshotId), eq(jobs.action, "initialize"))).limit(1);
	if (prior) {
		if (prior.authority.principal.authUserId !== actor) throw new ParticipationDenied();
		return present(prior);
	}
	const [row] = await tx.insert(jobs).values({ ...value, proposalId: null, action: "initialize", reason: "Requested source intake", authority: ParticipationAuthoritySchema.parse(authority) }).returning();
	if (!row) throw new Error("Release intake admission returned no row");
	await admitStage(tx, row, "prepare");
	return present(row);
}

/** @alpha Admission only: no archive I/O or native component work in the HTTP transaction. */
export async function enqueueMusicReleaseSourceJob(tx: DatabaseTransaction, actor: string, input: z.input<typeof inputSchema>) {
	const value = inputSchema.parse(input);
	const { proposal, binding, authority } = await authorize(tx, actor, value);
	const prior = await tx.select().from(jobs).where(and(eq(jobs.sourceRecordId, value.sourceRecordId), eq(jobs.proposalId, value.proposalId), eq(jobs.action, value.action))).limit(1);
	if (prior[0]) return present(prior[0]);
	if (!proposal || !binding || proposal.state !== (value.action === "apply" ? "pending" : "applied")) throw new TypeError("Release proposal cannot enter the requested job");
	const [row] = await tx.insert(jobs).values({ ...value, snapshotId: proposal.snapshotId, musicId: binding.reference.id, authority: ParticipationAuthoritySchema.parse(authority) }).returning();
	if (!row) throw new Error("Music release job admission returned no row");
	await admitStage(tx, row, "prepare");
	return present(row);
}

/** @alpha Exact source-local lookup; authorization is checked against the current target. */
export async function readMusicReleaseSourceJob(tx: DatabaseTransaction, actor: string, input: z.input<typeof locatorSchema>) {
	const value = locatorSchema.parse(input);
	const [row] = await tx.select().from(jobs).where(key(value)).limit(1);
	if (!row) throw new CatalogReferenceNotFound();
	await authorize(tx, actor, row);
	return present(row);
}

/** @alpha Pause linearizes against publication; resume creates a new generation with current authority. */
export async function controlMusicReleaseSourceJob(tx: DatabaseTransaction, actor: string, input: z.input<typeof locatorSchema> & { action: "pause" | "resume" }) {
	const value = locatorSchema.extend({ action: z.enum(["pause", "resume"]) }).parse(input);
	const [located] = await tx.select().from(jobs).where(key(value)).limit(1);
	if (!located) throw new CatalogReferenceNotFound();
	const { authority } = await authorize(tx, actor, located);
	const [row] = await tx.select().from(jobs).where(key(value)).limit(1).for("update");
	if (!row) throw new CatalogReferenceNotFound();
	if (["succeeded", "superseded"].includes(row.state)) return present(row);
	if (value.action === "pause" && row.state === "paused") return present(row);
	if (value.action === "resume" && !["paused", "failed"].includes(row.state)) return present(row);
	const [updated] = await tx.update(jobs).set({ state: value.action === "pause" ? "paused" : row.preparationComplete ? "prepared" : "queued",
		generation: row.generation + 1, authority: ParticipationAuthoritySchema.parse(authority), outcomeCode: null }).where(key(value)).returning();
	if (!updated) throw new Error("Music release job disappeared");
	if (value.action === "resume") await admitStage(tx, updated, updated.preparationComplete ? "publish" : "prepare");
	return present(updated);
}

async function archived(tx: DatabaseTransaction, row: typeof jobs.$inferSelect, archive?: CatalogSourceArchive) {
	const [proposal] = row.proposalId ? await tx.select().from(proposals).where(and(eq(proposals.sourceRecordId, row.sourceRecordId), eq(proposals.id, row.proposalId))).limit(1) : [];
	if (row.action !== "initialize" && !proposal) throw new CatalogReferenceNotFound();
	let beforeSnapshotId = row.preparation?.beforeSnapshotId ?? (row.action === "initialize" ? row.snapshotId : undefined);
	if (!beforeSnapshotId) {
		if (row.action === "withdraw") {
			const [application] = await tx.select({ previousSnapshotId: applications.previousSnapshotId }).from(applications)
				.where(and(eq(applications.sourceRecordId, row.sourceRecordId), eq(applications.proposalId, z.uuid().parse(row.proposalId)), eq(applications.action, "apply"))).limit(1);
			beforeSnapshotId = application?.previousSnapshotId ?? undefined;
		} else {
			const binding = await lockCatalogSourceBinding(tx, { sourceRecordId: row.sourceRecordId, mappingKey: z.uuid().parse(proposal?.mappingKey) });
			beforeSnapshotId = binding.claim.appliedCorrespondenceRevision === binding.claim.correspondenceRevision ? binding.claim.observedSnapshotId ?? undefined : undefined;
		}
	}
	if (!beforeSnapshotId) throw new TypeError("Music release update requires an adopted baseline");
	const before = await loadCatalogSourceReceipt(tx, row.sourceRecordId, beforeSnapshotId, archive);
	const after = await loadCatalogSourceReceipt(tx, row.sourceRecordId, row.snapshotId, archive);
	const preparation = preparationSchema.parse({ beforeSnapshotId, afterSnapshotId: row.snapshotId, beforeSha256: before.contentSha256, afterSha256: after.contentSha256 });
	if (row.preparation && JSON.stringify(preparationSchema.parse(row.preparation)) !== JSON.stringify(preparation)) throw new TypeError("Prepared archive manifest changed");
	for (const receipt of [before, after]) if (receipt.contractSha256 !== MusicBrainzCatalogContractSha256 || receipt.key.source !== "musicbrainz" || receipt.key.objectType !== "release") throw new TypeError("Unreviewed release source archive");
	return { before, after, preparation };
}

/** @internal Durable prepare/publish stages use source archives, existing task fencing, and one final native transaction. */
export function createMusicReleaseSourceHandlers(database: DatabaseExecutor, route: StreamRoute, dispose: EventHandler<unknown>["dispose"], archive?: CatalogSourceArchive): EventHandler<unknown>[] {
	if (route.class !== "task") return [];
	return (["prepare", "publish"] as const).map((phase) => ({
		route, kind: `source.music_release.${phase}`, durable: `music-release-${phase}-v1`, parsePayload: (input: unknown) => taskSchema.parse(input), dispose,
		async apply({ envelope, signal }) {
			const value = taskSchema.parse(envelope.payload);
			if (envelope.class !== "task" || envelope.kind !== `source.music_release.${phase}` || value.consumerKey !== `music-release-${phase}-v1` || envelope.aggregate.owner !== "source_record" || envelope.aggregate.key !== value.sourceRecordId || envelope.routingBucket !== route.bucket || envelope.routingEpoch !== route.epoch)
				throw new TypeError("Release task differs from its admitted route");
			const parsed = parseTaskRequest(envelope);
			const claim = await database.transaction((tx) => claimOperationalTask(tx, parsed.identity, 30_000));
			if (claim.status === "terminal") {
				if (claim.outcome === "failed") await database.transaction((tx) => tx.update(jobs).set({ state: "failed", outcomeCode: "execution_budget_exhausted" })
					.where(and(key(value), eq(jobs.generation, value.generation), eq(jobs.state, phase === "prepare" ? "queued" : "prepared"))));
				return { status: "terminal" as const, receiptId: claim.receiptId };
			}
			if (claim.status !== "claimed") return { status: "retry" as const, delayMs: 1000 };
			try {
				const loaded = await database.transaction(async (tx) => {
					const [row] = await tx.select().from(jobs).where(key(value)).limit(1);
					if (!row) throw new CatalogReferenceNotFound();
					if (row.generation !== value.generation || row.nextDependencyPosition !== value.afterPosition || row.state !== (phase === "prepare" ? "queued" : "prepared")) return { row, evidence: null };
					return runWithParticipationAuthority(ParticipationAuthoritySchema.parse(row.authority), async () => {
						await authorize(tx, row.authority.principal.authUserId, row);
						return { row, evidence: await archived(tx, row, archive) };
					});
				});
				// Archive I/O and JSON parsing never hold the owner lock. Receipts enforce 8 MiB/document.
				const bytes = loaded.evidence ? await Promise.all([readCatalogSourceBytes(loaded.evidence.before), readCatalogSourceBytes(loaded.evidence.after)]) : null;
				if (bytes) preflightMusicBrainzReleaseDelta(MusicBrainzReleaseSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes[0]!))), MusicBrainzReleaseSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes[1]!))));
				if (signal.aborted) throw signal.reason;
				const completed = await database.transaction(async (tx) => {
					await tx.execute(sql`select set_config('transaction_timeout','25000',true), set_config('statement_timeout','10000',true), set_config('lock_timeout','5000',true)`);
					return completeOperationalTask(tx, claim.lease, "succeeded", `music_release_${phase}`, async (tx) => {
						await runWithParticipationAuthority(ParticipationAuthoritySchema.parse(loaded.row.authority), async () => {
							await authorize(tx, loaded.row.authority.principal.authUserId, loaded.row);
							const [row] = await tx.select().from(jobs).where(key(value)).limit(1).for("update");
							if (!row || row.generation !== value.generation || row.nextDependencyPosition !== value.afterPosition || row.state !== (phase === "prepare" ? "queued" : "prepared")) return;
							if (!loaded.evidence || !bytes) throw new Error("Release job lost its prepared evidence");
							if (phase === "prepare") {
								const direct = row.authority.principal.kind === "auth" && !row.authority.grant;
								const previous = row.nextDependencyPosition >= 4096;
								const documentIndex = previous ? 0 : 1;
								const parsedDocument = MusicBrainzReleaseSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes[documentIndex]!)));
								const plan = planMusicBrainzDependencies("release", parsedDocument, 4096);
								const position = row.nextDependencyPosition % 4096;
								let nextPosition = row.nextDependencyPosition;
								let prepared = true;
								if (direct && row.action !== "withdraw") {
									await prepareMusicBrainzProposalDependencies(tx, row.authority.principal.authUserId, { proposalId: row.proposalId,
										sourceRecordId: row.sourceRecordId, snapshotId: previous ? loaded.evidence.preparation.beforeSnapshotId : row.snapshotId,
										receipt: previous ? loaded.evidence.before : loaded.evidence.after, bytes: bytes[documentIndex]!,
										afterPosition: position, sourcePage: true, purpose: previous ? "previous-for-withdrawal" : "incoming" });
									nextPosition += Math.min(128, Math.max(0, plan.length - position));
									if (position + 128 < plan.length) prepared = false;
									else if (!previous && row.action === "apply") { nextPosition = 4096; prepared = false; }
								}
								const [updated] = await tx.update(jobs).set({ preparation: loaded.evidence.preparation,
									preparationComplete: prepared, nextDependencyPosition: nextPosition, state: prepared ? "prepared" : "queued" }).where(key(value)).returning();
								if (!updated) throw new Error("Release preparation disappeared");
								await admitStage(tx, updated, prepared ? "publish" : "prepare");
							} else if (row.action === "initialize") {
								const [source] = await tx.select({ head: records.headSnapshotId }).from(records).where(eq(records.id, row.sourceRecordId)).limit(1);
								if (source?.head !== row.snapshotId) {
									await tx.update(jobs).set({ state: "superseded", outcomeCode: "source_snapshot_changed" }).where(key(value));
									return;
								}
								const result = await adoptMusicBrainzRelease(tx, row.authority.principal.authUserId, loaded.evidence.after, bytes[1]!);
								if (result.reference.owner !== "music") throw new TypeError("Release intake resolved another owner");
								await tx.update(jobs).set({ state: "succeeded", musicId: result.reference.id, outcomeCode: result.status }).where(key(value));
							} else {
								const result = await decideCatalogSourceProposal(tx, row.authority.principal.authUserId, { sourceRecordId: row.sourceRecordId, proposalId: z.uuid().parse(row.proposalId), action: row.action, reason: row.reason, mappingVersion: "musicbrainz.release.1" }, musicBrainzReleaseNativeWriter({ receipt: loaded.evidence.before, bytes: bytes[0]! }, { receipt: loaded.evidence.after, bytes: bytes[1]! }));
								await tx.update(jobs).set({ state: result.status === "superseded" ? "superseded" : "succeeded", outcomeCode: result.status }).where(key(value));
							}
							if (signal.aborted) throw signal.reason;
						});
					});
				});
				return { status: "committed" as const, receiptId: completed.receiptId };
			} catch (error) {
				if (signal.aborted) throw error;
				// Claim committed before work. Failed publication rolls back, then records a bounded retry or terminal proof.
				return database.transaction(async (tx) => {
					const terminal = error instanceof RangeError || error instanceof TypeError || error instanceof ParticipationDenied;
					if (terminal) {
						const completed = await completeOperationalTask(tx, claim.lease, "failed", error instanceof RangeError ? "publication_capacity_exceeded" : "release_command_rejected", async (tx) => {
							await tx.update(jobs).set({ state: error instanceof RangeError ? "blocked" : "failed", outcomeCode: error instanceof RangeError ? "publication_capacity_exceeded" : "release_command_rejected" })
								.where(and(key(value), eq(jobs.generation, value.generation), eq(jobs.state, phase === "prepare" ? "queued" : "prepared")));
						});
						return { status: "terminal" as const, receiptId: completed.receiptId };
					}
					const result = await retryOperationalTask(tx, claim.lease, 5_000, "music_release_publication_retry");
					if (result.status === "terminal") {
						await tx.update(jobs).set({ state: "failed", outcomeCode: "execution_budget_exhausted" }).where(and(key(value), eq(jobs.generation, value.generation), eq(jobs.state, phase === "prepare" ? "queued" : "prepared")));
						return { status: "terminal" as const, receiptId: result.receiptId };
					}
					return result;
				});
			}
		},
	}));
}
