import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { WorkPolicy } from "../performance/policy";
import { RecommendationPartitionLeaseSchema } from "./build-partitions";
import { RecommendationPolicy } from "./policy";

const lease = {
	snapshotId: "018f1a2b-3c4d-7000-8000-000000000001",
	bucket: 0,
	generation: 1,
	token: "018f1a2b-3c4d-7000-8000-000000000002",
} as const;

describe("recommendation refresh work bounds", () => {
	it("keeps the online candidate window and minimum refresh interval", () => {
		expect(WorkPolicy.recommendation.maxOnlineCandidates).toBe(256);
		expect(WorkPolicy.recommendation.maxRelationCandidates).toBe(256);
		expect(WorkPolicy.recommendation.minimumRefreshIntervalMs).toBe(3_600_000);
		expect(RecommendationPolicy.maxCandidates).toBe(
			WorkPolicy.recommendation.maxOnlineCandidates,
		);
	});

	it("does not restore the retired unit-identity graph or multi-score projections", async () => {
		const sources = await Promise.all([
			readFile(new URL("./worker.ts", import.meta.url), "utf8"),
			readFile(new URL("./build-partitions.ts", import.meta.url), "utf8"),
		]);
		const source = sources.join("\n");
		expect(source).toContain("dispatchRecommendationBuild");
		expect(source).not.toContain("FROM unit_identity");
		expect(source).not.toContain("buildUnitEdges");
		expect(source).not.toContain("hot_score");
		expect(source).not.toContain("rising_score");
	});
});

describe("recommendation build policy closed bounds", () => {
	it("fixes the 64-partition control plane and 4096-row page", () => {
		expect(RecommendationPolicy.buildPartitions).toBe(64);
		expect(RecommendationPolicy.buildBatchSize).toBe(4096);
		expect(RecommendationPolicy.buildConcurrency).toBe(4);
		expect(RecommendationPolicy.buildMaximumFailures).toBe(12);
		expect(RecommendationPolicy.buildTransactionMs).toBeLessThan(RecommendationPolicy.buildLeaseMs);
		expect(RecommendationPolicy.buildLeaseMs).toBe(30_000);
		expect(RecommendationPolicy.buildTransactionMs).toBe(20_000);
		expect(RecommendationPolicy.buildDeadlineMs).toBe(2 * 3_600_000);
	});

	it("keeps finite positive decay inputs on a closed window", () => {
		expect(RecommendationPolicy.bestWindowDays).toBe(7);
		expect(RecommendationPolicy.bestHalfLifeHours).toBe(24);
		expect(RecommendationPolicy.bestWindowDays * 24).toBeGreaterThan(
			RecommendationPolicy.bestHalfLifeHours,
		);
	});
});

describe("recommendation partition lease schema", () => {
	it("accepts the closed bucket and generation bounds used after a claim", () => {
		expect(RecommendationPartitionLeaseSchema.parse({ ...lease, bucket: 0 }).bucket).toBe(0);
		expect(RecommendationPartitionLeaseSchema.parse({ ...lease, bucket: 63 }).bucket).toBe(63);
		expect(
			RecommendationPartitionLeaseSchema.parse({
				...lease,
				generation: Number.MAX_SAFE_INTEGER,
			}).generation,
		).toBe(Number.MAX_SAFE_INTEGER);
	});

	it("rejects buckets, generations, and identities outside the accepted lease", () => {
		expect(() => RecommendationPartitionLeaseSchema.parse({ ...lease, bucket: -1 })).toThrow();
		expect(() => RecommendationPartitionLeaseSchema.parse({ ...lease, bucket: 64 })).toThrow();
		expect(() => RecommendationPartitionLeaseSchema.parse({ ...lease, bucket: 0.5 })).toThrow();
		expect(() => RecommendationPartitionLeaseSchema.parse({ ...lease, generation: 0 })).toThrow();
		expect(() => RecommendationPartitionLeaseSchema.parse({ ...lease, generation: -1 })).toThrow();
		expect(() =>
			RecommendationPartitionLeaseSchema.parse({
				...lease,
				generation: Number.MAX_SAFE_INTEGER + 1,
			}),
		).toThrow();
		expect(() =>
			RecommendationPartitionLeaseSchema.parse({ ...lease, snapshotId: "not-a-uuid" }),
		).toThrow();
		expect(() =>
			RecommendationPartitionLeaseSchema.parse({ ...lease, token: "not-a-uuid" }),
		).toThrow();
		const extra: unknown = { ...lease, extra: true };
		expect(() => RecommendationPartitionLeaseSchema.parse(extra)).toThrow();
	});
});
