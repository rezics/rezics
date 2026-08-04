import { describe, expect, it, vi } from "vitest";

import {
	assertLocalLifecycleTargets,
	isIndexAlreadyExistsFailure,
	MeilisearchTaskFailure,
	parseMeilisearchTask,
	parseSearchIndexUid,
	parseSequinSinks,
	ProjectionConfigurationError,
	ProjectionIntegrityError,
	ProjectionTimeoutError,
	waitForProjectionReady,
} from "./search-index-support";

describe("search index lifecycle support", () => {
	it("accepts only the index-exists task race as idempotent creation", () => {
		const task = parseMeilisearchTask({
			status: "failed",
			error: { code: "index_already_exists", message: "already exists" },
		});
		const expectedRace = new MeilisearchTaskFailure(42, "failed", task.error, task.errorCode);
		expect(isIndexAlreadyExistsFailure(expectedRace)).toBe(true);
		expect(
			isIndexAlreadyExistsFailure(
				new MeilisearchTaskFailure(42, "failed", { code: "internal" }, "internal"),
			),
		).toBe(false);
	});

	it("proves versioned index UIDs before lifecycle use", () => {
		expect(parseSearchIndexUid("current", "rezics_units_v1_20260804")).toBe(
			"rezics_units_v1_20260804",
		);
		expect(parseSearchIndexUid("current", "rezics_units_v2_20260721")).toBe(
			"rezics_units_v2_20260721",
		);
		expect(parseSearchIndexUid("current", "rezics_units_v2_20260721_131500")).toBe(
			"rezics_units_v2_20260721_131500",
		);
		expect(() => parseSearchIndexUid("current", "rezics_revisions_v2_20260721")).toThrow(
			TypeError,
		);
	});

	it("rejects destructive lifecycle targets outside loopback", () => {
		expect(() =>
			assertLocalLifecycleTargets({
				databaseUrl: "postgres://rezics@localhost/rezics",
				meilisearchUrl: "https://search.example.com",
				sequinUrl: "http://127.0.0.1:7376",
			}),
		).toThrow(ProjectionConfigurationError);
	});

	it("validates the Sequin sink boundary without strengthening null backfill tables", () => {
		expect(
			parseSequinSinks({
				data: [
					{
						name: "rezics-revisions-v1-20260804",
						status: "disabled",
						health: { status: "paused" },
						source: { include_tables: ["public.search_revision_projection_source"] },
						active_backfills: [
							{
								id: "backfill-id",
								state: "active",
								table: null,
								rows_processed_count: 0,
							},
						],
					},
				],
			}),
		).toEqual([
			{
				name: "rezics-revisions-v1-20260804",
				status: "disabled",
				healthStatus: "paused",
				sourceTables: ["public.search_revision_projection_source"],
				activeBackfills: [{ id: "backfill-id", state: "active", rowsProcessedCount: 0 }],
			},
		]);
	});

	it("reports pending progress and returns a confirmed watermark", async () => {
		let time = 0;
		const report = vi.fn();
		const probe = vi
			.fn()
			.mockResolvedValueOnce({ status: "pending", reason: "backfill 10/100 rows" })
			.mockResolvedValueOnce({ status: "ready", confirmedLsn: "0/123" });

		await expect(
			waitForProjectionReady({
				indexUid: parseSearchIndexUid("current", "rezics_units_v2_20260721"),
				probe,
				timeoutMs: 10_000,
				integrityGraceMs: 3_000,
				pollIntervalMs: 1_000,
				progressIntervalMs: 5_000,
				now: () => time,
				sleep: async (milliseconds) => {
					time += milliseconds;
				},
				report,
			}),
		).resolves.toBe("0/123");
		expect(report).toHaveBeenCalledWith(
			"Waiting for rezics_units_v2_20260721: backfill 10/100 rows",
		);
	});

	it("fails a stable identity mismatch after the integrity grace period", async () => {
		let time = 0;
		await expect(
			waitForProjectionReady({
				indexUid: parseSearchIndexUid("current", "rezics_units_v2_20260721"),
				probe: async () => ({
					status: "integrity_mismatch",
					reason: "stale document old-id",
					fingerprint: "old-id:missing",
				}),
				timeoutMs: 20_000,
				integrityGraceMs: 3_000,
				pollIntervalMs: 1_000,
				progressIntervalMs: 5_000,
				now: () => time,
				sleep: async (milliseconds) => {
					time += milliseconds;
				},
				report: vi.fn(),
			}),
		).rejects.toBeInstanceOf(ProjectionIntegrityError);
	});

	it("times out with the last observable pending reason", async () => {
		let time = 0;
		await expect(
			waitForProjectionReady({
				indexUid: parseSearchIndexUid("history", "rezics_revisions_v1_20260804"),
				probe: async () => ({ status: "pending", reason: "sink is unhealthy" }),
				timeoutMs: 2_000,
				integrityGraceMs: 1_000,
				pollIntervalMs: 1_000,
				progressIntervalMs: 5_000,
				now: () => time,
				sleep: async (milliseconds) => {
					time += milliseconds;
				},
				report: vi.fn(),
			}),
		).rejects.toThrow(ProjectionTimeoutError);
	});
});
