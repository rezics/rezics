import assert from "node:assert/strict";
import { Client } from "pg";

// This executable exercises the production Drizzle writer against disposable PostgreSQL.
const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("DATABASE_URL and REZICS_DISPOSABLE_MIGRATION_FIXTURE=1 are required");
const url = new URL(connectionString);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/rezics_atlas")
	throw new Error("Email outbox checks require a loopback disposable rezics_atlas database");
const client = new Client({ connectionString, statement_timeout: 10_000 });
await client.connect();
assert.equal(
	(await client.query("select current_database() as name")).rows[0]?.name,
	"rezics_atlas",
);
assert.equal(
	(await client.query("select exists(select 1 from public.email_outbox) as occupied")).rows[0]
		?.occupied,
	false,
	"Use a fresh replay database; this check must not claim pre-existing email intents",
);

const { database } = await import("../src/services/database");
const {
	claimEmailBatch,
	enqueueAuthenticationEmail,
	EmailLeaseLost,
	markEmailAccepted,
	markEmailFailed,
	renewEmailLease,
} = await import("../src/services/email/outbox");
const ids: string[] = [];
try {
	const id = await enqueueAuthenticationEmail({
		actionUrl: "https://example.invalid/verify?token=fixture",
		kind: "verify_email",
		locale: "en",
		recipientEmail: "fixture@example.invalid",
	});
	ids.push(id);
	const options = { batchSize: 1, leaseDurationMs: 60_000 };
	const [first] = await claimEmailBatch(options);
	assert.ok(first);
	assert.equal(first.id, id);
	assert.equal(first.attemptCount, 1);
	await client.query(
		"update public.email_outbox set lease_expires_at = clock_timestamp() - interval '1 second' where id = $1",
		[id],
	);
	await assert.rejects(() => renewEmailLease(first, 60_000), EmailLeaseLost);
	await assert.rejects(
		() => markEmailAccepted(first, { status: "logged", providerMessageId: null }, new Date()),
		EmailLeaseLost,
	);
	const [second] = await claimEmailBatch(options);
	assert.ok(second);
	assert.equal(second.attemptCount, 2);
	await assert.rejects(() => renewEmailLease(first, 60_000), EmailLeaseLost);
	await assert.rejects(
		() => markEmailAccepted(first, { status: "logged", providerMessageId: null }, new Date()),
		EmailLeaseLost,
	);
	for (const retryable of [true, false])
		await assert.rejects(
			() => markEmailFailed(first, { error: "stale", maxAttempts: 5, now: new Date(), retryable }),
			EmailLeaseLost,
		);
	const state = await client.query(
		"select status, attempt_count, last_error from public.email_outbox where id = $1",
		[id],
	);
	assert.deepEqual(state.rows, [{ status: "processing", attempt_count: 2, last_error: null }]);
	await renewEmailLease(second, 60_000);
	await markEmailAccepted(second, { status: "logged", providerMessageId: null }, new Date());
	const terminal = await client.query(
		"select status, action_url, recipient_email, locale from public.email_outbox where id = $1",
		[id],
	);
	assert.deepEqual(terminal.rows, [
		{ status: "accepted", action_url: null, recipient_email: null, locale: null },
	]);
	for (let index = 0; index < 8; index++)
		ids.push(
			await enqueueAuthenticationEmail({
				actionUrl: "https://example.invalid/reset",
				kind: "reset_password",
				locale: "en",
				recipientEmail: "fixture@example.invalid",
			}),
		);
	const batches = await Promise.all(
		Array.from({ length: 4 }, () => claimEmailBatch({ ...options, batchSize: 2 })),
	);
	const claims = batches.flat();
	assert.equal(claims.length, 8);
	assert.equal(new Set(claims.map((item) => item.id)).size, 8);
	assert.ok(claims.every((item) => item.attemptCount === 1));
	console.info(
		JSON.stringify({
			expiredLeaseDenied: true,
			reclaimedLeaseDenied: true,
			sensitivePayloadCleared: true,
			concurrentClaims: claims.length,
		}),
	);
} finally {
	await client.query("delete from public.email_outbox where id = any($1::uuid[])", [ids]);
	await client.end();
	await database.$client.end();
}
