import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { users } from "@rezics/schema/postgres/identity/auth";
import { softwareIdentity } from "@rezics/schema/postgres/catalog/identity";
import { createVisualNovel } from "../src/services/catalog/domains";
import {
	createSoftwareParticipationContext,
	readSoftwareParticipationContext,
	reviseSoftwareParticipationContext,
} from "../src/services/catalog/software-contexts";
import { CatalogRevisionConflict } from "../src/services/catalog/storage";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	target.pathname !== "/rezics_atlas_contexts_concurrency"
)
	throw new Error(
		"Concurrency acceptance writes committed fixtures only in rezics_atlas_contexts_concurrency; discard the clone afterwards",
	);
const pool = new Pool({
	connectionString,
	max: 4,
	statement_timeout: 10000,
	application_name: "software-context-concurrency",
});
const database = drizzle({ client: pool });
const values = { label: "Concurrent participation", languageTag: "en", state: "active" } as const;
function gate() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}
function pgCode(error: unknown): string | undefined {
	if (!error || typeof error !== "object") return undefined;
	if ("code" in error && typeof error.code === "string") return error.code;
	return "cause" in error ? pgCode(error.cause) : undefined;
}
try {
	const fixture = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: "Context concurrency fixture",
				email: `${crypto.randomUUID()}@example.invalid`,
			})
			.returning({ id: users.id });
		assert.ok(account);
		const content = await createVisualNovel(tx, account.id, {
			value: "Concurrent contexts",
			languageTag: "en",
		});
		const first = await createSoftwareParticipationContext(tx, content, account.id, values);
		const second = await createSoftwareParticipationContext(tx, content, account.id, values);
		return { account, content, first, second };
	});
	const held = gate();
	const release = gate();
	const holder = database.transaction(async (tx) => {
		await reviseSoftwareParticipationContext(
			tx,
			fixture.content,
			fixture.account.id,
			fixture.first.contextId,
			1,
			values,
		);
		held.resolve();
		await release.promise;
	});
	await held.promise;
	try {
		const start = performance.now();
		await database.transaction(async (tx) => {
			await tx.execute(sql`set local lock_timeout = '500ms'`);
			await reviseSoftwareParticipationContext(
				tx,
				fixture.content,
				fixture.account.id,
				fixture.second.contextId,
				1,
				values,
			);
		});
		console.info(
			`Independent context revision committed in ${(performance.now() - start).toFixed(1)}ms while another context writer held its transaction.`,
		);
		await assert.rejects(
			database.transaction(async (tx) => {
				await tx.execute(sql`set local lock_timeout = '100ms'`);
				await tx
					.update(softwareIdentity)
					.set({ status: "draft" })
					.where(eq(softwareIdentity.id, fixture.content.id));
			}),
			(error: unknown) => pgCode(error) === "55P03",
		);
	} finally {
		release.resolve();
		await holder;
	}
	const winnerHeld = gate();
	const releaseWinner = gate();
	const winner = database.transaction(async (tx) => {
		await reviseSoftwareParticipationContext(
			tx,
			fixture.content,
			fixture.account.id,
			fixture.first.contextId,
			2,
			{ ...values, label: "Winner" },
		);
		winnerHeld.resolve();
		await releaseWinner.promise;
	});
	await winnerHeld.promise;
	const loserStarted = gate();
	let loserPid: number | undefined;
	const loser = database
		.transaction(async (tx) => {
			const pidResult = await tx.execute(sql`select pg_backend_pid() as pid`);
			loserPid = z.object({ pid: z.number().int() }).parse(pidResult.rows[0]).pid;
			loserStarted.resolve();
			await reviseSoftwareParticipationContext(
				tx,
				fixture.content,
				fixture.account.id,
				fixture.first.contextId,
				2,
				{ ...values, label: "Loser" },
			);
		})
		.then(
			() => ({ status: "committed" as const }),
			(error: unknown) => ({ status: "rejected" as const, error }),
		);
	await loserStarted.promise;
	try {
		let blocked = false;
		const until = Date.now() + 2000;
		while (Date.now() < until) {
			const status = await pool.query(
				"select wait_event_type from pg_stat_activity where pid = $1",
				[loserPid],
			);
			if (
				z.object({ wait_event_type: z.string().nullable() }).parse(status.rows[0])
					.wait_event_type === "Lock"
			) {
				blocked = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		assert.equal(blocked, true, "Same-context writer must wait for the current-head lock");
	} finally {
		releaseWinner.resolve();
		await winner;
	}
	const outcome = await loser;
	assert.equal(outcome.status, "rejected");
	if (outcome.status !== "rejected") throw new Error("Stale writer unexpectedly committed");
	assert.ok(outcome.error instanceof CatalogRevisionConflict);
	await database.transaction(async (tx) => {
		const current = await readSoftwareParticipationContext(
			tx,
			fixture.content,
			fixture.account.id,
			fixture.first.contextId,
		);
		assert.equal(current.revision, 3);
		assert.equal(current.label, "Winner");
	});
	console.info(
		"Verified independent-context concurrency, exclusive owner transition blocking, and same-context stale-writer conflict; fixture rows remain only in the disposable concurrency clone.",
	);
} finally {
	await pool.end();
}
