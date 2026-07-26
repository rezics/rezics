import { describe, expect, it, vi } from "vitest";

import { cleanupClaimedImageAssets, imageAssetCleanupCutoff } from "./cleanup";

describe("expired image asset cleanup", () => {
	it("starts only after the upload expiry and cleanup grace have elapsed", () => {
		const now = new Date("2026-07-27T00:30:00.000Z");

		expect(imageAssetCleanupCutoff(now, 900, 300_000)).toEqual(
			new Date("2026-07-27T00:10:00.000Z"),
		);
	});

	it("finalizes only objects whose storage deletion succeeded", async () => {
		const deleteObject = vi.fn(async (storageKey: string) => {
			if (storageKey === "objects/fails") throw new Error("storage unavailable");
		});
		const finalize = vi.fn(async () => undefined);

		await expect(
			cleanupClaimedImageAssets(
				[
					{ id: "asset-ok", storageKey: "objects/ok" },
					{ id: "asset-fails", storageKey: "objects/fails" },
					{ id: "asset-also-ok", storageKey: "objects/also-ok" },
				],
				{ deleteObject, finalize },
			),
		).rejects.toThrow(AggregateError);
		expect(deleteObject).toHaveBeenCalledTimes(3);
		expect(finalize.mock.calls).toEqual([["asset-ok"], ["asset-also-ok"]]);
	});

	it("returns the completed cleanup count", async () => {
		const operations = {
			deleteObject: vi.fn(async () => undefined),
			finalize: vi.fn(async () => undefined),
		};

		await expect(
			cleanupClaimedImageAssets([{ id: "asset-ok", storageKey: "objects/ok" }], operations),
		).resolves.toBe(1);
	});
});
