import type { Pool } from "pg";
import { afterAll, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pool: undefined as Pool | undefined, logError: vi.fn() }));

vi.mock("../config", () => ({
	env: { DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused" },
}));
vi.mock("@rezics/observability", () => ({
	instrumentPostgresClient: (pool: Pool) => {
		state.pool = pool;
		return pool;
	},
	peekActiveObservability: () => ({
		logger: { error: state.logError },
		metrics: { registerDatabasePool: vi.fn() },
	}),
}));

await import("./index");
afterAll(async () => {
	await state.pool?.end();
});

it("handles and records an idle connection failure without an uncaught process error", () => {
	const error = new Error("Connection terminated unexpectedly");
	expect(state.pool).toBeDefined();
	expect(() => state.pool!.emit("error", error)).not.toThrow();
	expect(state.logError).toHaveBeenCalledWith("Idle PostgreSQL connection failed", {
		eventName: "database.pool.connection_failed",
		errorCode: "DatabaseConnectionFailed",
		error,
	});
});
