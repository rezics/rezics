import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	unitMergeOperation,
	unitMergeRequest,
	unitMergeRedirect,
	unitMergeReconciliationItem,
	unitMergeGraphLock,
	platformCapabilityGrant,
	catalogSourceMappingClaim,
	catalogSourceBindingRevision,
	catalogSourceSubscription,
	operationalOutbox,
	operationalCapacity,
} from "../src/services/database/schema";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import { CatalogNameTables } from "../src/services/database/schema/catalog-names";
import { CatalogFactTables } from "../src/services/database/schema/catalog-facts";
import {
	claimUnitMergeOperations,
	processClaimedUnitMergePage,
	dispatchUnitMergeBatch,
} from "../src/services/units/merge/worker";
import { createReviewedFixtureMerge } from "./reference-merge-fixture";
import { addCatalogName } from "../src/services/catalog/names";
import { loadCatalogIdentity } from "../src/services/catalog/storage";
import {
	storeCatalogSourcePayload,
	recordCatalogSourceObservation,
	type CatalogSourceArchive,
} from "../src/services/catalog/source-observations";
import { bindCatalogSourceIdentity } from "../src/services/catalog/source-bindings";
import { catalogSourceRecordId } from "../src/services/catalog/source-record-key";
import { aggregateRoutingBucket } from "../src/services/events/envelope";
import type { CatalogReference } from "@rezics/reference";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Phase recovery requires a disposable loopback target",
);
type Operation = typeof unitMergeOperation.$inferSelect;
type Binding = { sourceRecordId: string; mappingKey: string; routingBucket: number };
let checks = 0;
const phaseEvidence: unknown[] = [];
const objects = new Map<string, Uint8Array>();
const archive: CatalogSourceArchive = {
	async put(input) {
		objects.set(input.Key, input.Body);
	},
	async get(input) {
		const bytes = objects.get(input.Key);
		return { Body: bytes ? Readable.from([bytes]) : undefined };
	},
};
function same(actual: unknown, expected: unknown) {
	assert.deepEqual(actual, expected);
	checks++;
}
async function addBinding(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
): Promise<Binding> {
	const key = {
		source: "vndb",
		objectType: "vn",
		externalId: `phase-recovery-${crypto.randomUUID()}`,
	};
	const routingBucket = aggregateRoutingBucket("source_record", catalogSourceRecordId(key));
	await tx
		.insert(operationalCapacity)
		.values(
			["event-outbox", "task-outbox", "task-intent", "receipt"].map((lane) => ({
				routingBucket,
				lane,
				maximumRows: 10000n,
				maximumBytes: 128_000_000n,
			})),
		)
		.onConflictDoNothing();
	const observation = await recordCatalogSourceObservation(
		tx,
		await storeCatalogSourcePayload(
			key,
			Buffer.from(JSON.stringify({ title: reference.id })),
			"a".repeat(64),
			null,
			archive,
		),
	);
	const claim = await bindCatalogSourceIdentity(tx, actor, {
		sourceRecordId: observation.record.id,
		path: "/",
		snapshotId: observation.snapshot.id,
		reference,
	});
	return { sourceRecordId: observation.record.id, mappingKey: claim.mappingKey, routingBucket };
}
async function readOperation(id: string) {
	const [row] = await database
		.select()
		.from(unitMergeOperation)
		.where(eq(unitMergeOperation.id, id));
	assert.ok(row);
	return row;
}
async function claim(op: Operation) {
	const [current] = await claimUnitMergeOperations(new Date(), 1, [op.shard]);
	assert.equal(current?.id, op.id, "Claim only this fixture's phase");
	assert.ok(current);
	return current;
}
async function reach(op: Operation, phase: Operation["phase"]) {
	for (let page = 0; page < 20; page++) {
		const current = await readOperation(op.id);
		if (current.phase === phase && current.state === "pending") return current;
		same((await processClaimedUnitMergePage(await claim(current))).outcome, "continued");
	}
	throw new Error(`Did not reach ${phase}`);
}
async function crash(claimed: Operation) {
	console.info(
		JSON.stringify({
			fixturePhase: claimed.phase,
			operationId: claimed.id,
			requestId: claimed.requestId,
		}),
	);
	const child = spawn(
		process.execPath,
		[
			"--import",
			"tsx",
			fileURLToPath(new URL("./check-merge-recovery.ts", import.meta.url)),
			"--crash-page",
			claimed.id,
		],
		{
			env: process.env,
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 45000,
			killSignal: "SIGKILL",
		},
	);
	let output = "";
	child.stdout.on("data", (chunk) => {
		output += String(chunk);
	});
	child.stderr.on("data", (chunk) => {
		output += String(chunk);
	});
	const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
		(resolve, reject) => {
			child.once("error", reject);
			child.once("close", (code, signal) => resolve({ code, signal }));
		},
	);
	assert.equal(result.signal, "SIGKILL", output);
	checks++;
	assert.ok(output.includes("merge-page-written-before-commit"), output);
	checks++;
}
async function expire(claimed: Operation) {
	await database
		.update(unitMergeOperation)
		.set({ leaseExpiresAt: new Date(Date.now() - 1000) })
		.where(
			and(
				eq(unitMergeOperation.id, claimed.id),
				eq(unitMergeOperation.leaseToken, claimed.leaseToken!),
			),
		);
}
type Pair = Awaited<ReturnType<typeof createReviewedFixtureMerge>>;
async function snapshot(pair: Pair, binding?: Binding) {
	const identity = CatalogIdentityTables.publishing,
		name = CatalogNameTables.publishing.name,
		change = CatalogFactTables.publishing.change;
	const identities = await database
		.select()
		.from(identity)
		.where(inArray(identity.id, [pair.source.id, pair.target.id]))
		.orderBy(identity.id);
	const changes = await database
		.select()
		.from(change)
		.where(inArray(change.ownerId, [pair.source.id, pair.target.id]))
		.orderBy(change.ownerId, change.version);
	const names = await database
		.select()
		.from(name)
		.where(inArray(name.ownerId, [pair.source.id, pair.target.id]))
		.orderBy(name.ownerId, name.id);
	const redirects = await database
		.select()
		.from(unitMergeRedirect)
		.where(eq(unitMergeRedirect.sourceUnitId, pair.source.id));
	const items = await database
		.select()
		.from(unitMergeReconciliationItem)
		.where(eq(unitMergeReconciliationItem.requestId, pair.request.id))
		.orderBy(unitMergeReconciliationItem.id);
	const [request] = await database
		.select()
		.from(unitMergeRequest)
		.where(eq(unitMergeRequest.id, pair.request.id));
	const op = await readOperation(pair.operation.id);
	if (!binding)
		return { identities, changes, names, redirects, items, request, op, binding: undefined };
	const claims = await database
		.select()
		.from(catalogSourceMappingClaim)
		.where(eq(catalogSourceMappingClaim.sourceRecordId, binding.sourceRecordId));
	const history = await database
		.select()
		.from(catalogSourceBindingRevision)
		.where(eq(catalogSourceBindingRevision.sourceRecordId, binding.sourceRecordId))
		.orderBy(catalogSourceBindingRevision.revision);
	const projection = await database
		.select()
		.from(CatalogFactTables.publishing.sourceBinding)
		.where(eq(CatalogFactTables.publishing.sourceBinding.sourceRecordId, binding.sourceRecordId));
	const subscriptions = await database
		.select()
		.from(catalogSourceSubscription)
		.where(eq(catalogSourceSubscription.sourceRecordId, binding.sourceRecordId));
	const outbox = await database
		.select()
		.from(operationalOutbox)
		.where(
			and(
				eq(operationalOutbox.routingBucket, binding.routingBucket),
				eq(operationalOutbox.aggregateKey, binding.sourceRecordId),
			),
		)
		.orderBy(operationalOutbox.messageId);
	const capacity = await database
		.select()
		.from(operationalCapacity)
		.where(eq(operationalCapacity.routingBucket, binding.routingBucket))
		.orderBy(operationalCapacity.lane);
	return {
		identities,
		changes,
		names,
		redirects,
		items,
		request,
		op,
		binding: { claims, history, projection, subscriptions, outbox, capacity },
	};
}
const [runnable] = await database
	.select({ id: unitMergeOperation.id })
	.from(unitMergeOperation)
	.where(inArray(unitMergeOperation.state, ["pending", "processing", "retry_wait"]))
	.limit(1);
assert.equal(runnable, undefined, "Do not consume another fixture's runnable work");
for (const phase of ["canonicalize", "names", "bindings"] as const) {
	let binding: Binding | undefined;
	const pair = await withDatabaseTransactionDeadline(120000, () =>
		database.transaction((tx) =>
			createReviewedFixtureMerge(tx, {
				prepareSource: async (tx, source, actor) => {
					if (phase === "names") {
						const current = await loadCatalogIdentity(tx, source, actor, true);
						await addCatalogName(tx, source, actor, current.revision, {
							value: "Phase recovery source name",
							kind: "primary",
							languageTag: "en",
						});
					} else if (phase === "bindings") binding = await addBinding(tx, source, actor);
				},
			}),
		),
	);
	const pending = await reach(pair.operation, phase),
		first = await claim(pending);
	const before = await snapshot(pair, binding);
	await crash(first);
	same(await snapshot(pair, binding), before);
	await expire(first);
	const reclaimed = await claim(await readOperation(first.id));
	assert.notEqual(reclaimed.leaseToken, first.leaseToken);
	checks++;
	same((await processClaimedUnitMergePage(first)).outcome, "lease_lost");
	same((await processClaimedUnitMergePage(reclaimed)).outcome, "continued");
	const applied = await snapshot(pair, binding),
		source = applied.identities.find((row) => row.id === pair.source.id),
		target = applied.identities.find((row) => row.id === pair.target.id);
	assert.ok(source && target);
	if (phase === "canonicalize") {
		same(source.status, "archived");
		same(source.revision, pair.request.manifest.sourceRevision + 1);
		same(applied.redirects.length, 1);
		same(applied.changes.filter((row) => row.operation === "identity.merge.archive").length, 1);
	} else if (phase === "names") {
		same(applied.names.filter((row) => row.ownerId === pair.target.id).length, 1);
		same(target.revision, pair.request.manifest.targetRevision + 1);
		same(applied.items.filter((row) => row.kind === "name" && row.state === "applied").length, 1);
	} else {
		assert.ok(applied.binding);
		same(applied.binding.claims[0]?.bindingRevision, 2);
		same(applied.binding.history.length, 2);
		same(applied.binding.history[0]?.publishingId, pair.source.id);
		same(applied.binding.history[1]?.publishingId, pair.target.id);
		same(applied.binding.projection[0]?.ownerId, pair.target.id);
		same(applied.binding.subscriptions[0]?.state, "paused");
		same(
			applied.items.filter((row) => row.kind === "source_binding" && row.state === "applied")
				.length,
			1,
		);
	}
	same((await processClaimedUnitMergePage(reclaimed)).outcome, "lease_lost");
	same(await snapshot(pair, binding), applied);
	for (let page = 0; page < 20; page++) {
		const op = await readOperation(first.id);
		if (op.state === "completed") break;
		await processClaimedUnitMergePage(await claim(op));
	}
	same((await readOperation(first.id)).state, "completed");
	same(
		(
			await database
				.select()
				.from(unitMergeGraphLock)
				.where(eq(unitMergeGraphLock.operationId, first.id))
		).length,
		0,
	);
	phaseEvidence.push({
		phase,
		transactionFootprintRolledBack: true,
		staleLeaseRejected: true,
		replayDoesNotDuplicate: true,
		completed: true,
	});
}
// A crash has consumed no review: revocation before reclaim must still stop canonicalization.
const revoked = await withDatabaseTransactionDeadline(120000, () =>
	database.transaction(createReviewedFixtureMerge),
);
const claimBeforeRevocation = await claim(revoked.operation);
await crash(claimBeforeRevocation);
await database
	.update(platformCapabilityGrant)
	.set({ revokedAt: new Date(), revokedByAuthUserId: revoked.proposer.account.id })
	.where(eq(platformCapabilityGrant.authUserId, revoked.first.account.id));
await expire(claimBeforeRevocation);
same(await dispatchUnitMergeBatch(), 1);
const afterRevocation = await snapshot(revoked);
same(afterRevocation.identities.find((row) => row.id === revoked.source.id)?.status, "published");
same(afterRevocation.redirects.length, 0);
same(afterRevocation.request?.state, "superseded");
same(afterRevocation.op.state, "failed");
same(afterRevocation.op.lastErrorCode, "review_authority_changed");
same((await processClaimedUnitMergePage(claimBeforeRevocation)).outcome, "lease_lost");
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-merge-phase-recovery.ts",
	"services/main/scripts/check-merge-recovery.ts",
	"services/main/scripts/reference-merge-fixture.ts",
	"services/main/src/services/units/merge/worker.ts",
	"services/main/src/services/units/merge/review-application.ts",
	"services/main/src/services/catalog/source-bindings.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: (
			await database.execute(
				sql`select version() as postgres,current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		phaseEvidence,
		reviewerRevocationAfterCrashRejected: true,
		fixtureHistoryRetained: true,
	}),
);
await database.$client.end();
