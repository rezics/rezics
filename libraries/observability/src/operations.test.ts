import { describe, expect, it, vi } from "vitest";

import { instrumentPostgresClient } from "./operations";

describe("PostgreSQL instrumentation", () => {
	it("instruments clients acquired through promise-based pool connections", async () => {
		const rawClient = { query: vi.fn(async () => ({ rows: [] })) };
		const pool = { connect: vi.fn(async () => rawClient) };
		const instrumentedPool = instrumentPostgresClient(pool);

		const connected = await instrumentedPool.connect();
		const connectedAgain = await instrumentedPool.connect();
		expect(connected).not.toBe(rawClient);
		expect(connectedAgain).not.toBe(connected);
		expect(instrumentPostgresClient(connected)).toBe(connected);
		await connected.query();
		expect(rawClient.query).toHaveBeenCalledOnce();
	});

	it("instruments clients acquired through callback-based pool connections", async () => {
		const rawClient = { query: vi.fn(async () => ({ rows: [] })) };
		const release = vi.fn();
		const pool = {
			connect: vi.fn(
				(callback: (error: null, client: typeof rawClient, done: typeof release) => void) =>
					callback(null, rawClient, release),
			),
		};
		const instrumentedPool = instrumentPostgresClient(pool);

		await new Promise<void>((resolve) => {
			instrumentedPool.connect((_error, connected, done) => {
				expect(connected).not.toBe(rawClient);
				expect(done).toBe(release);
				resolve();
			});
		});
	});
});
