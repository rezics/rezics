import { describe, expect, it } from "vitest";
import { FavoriteSnapshotSchema, SaveFavoriteSchema } from "./contracts";

describe("private Favorite snapshots", () => {
	it("bounds notes by UTF-8 bytes and leaves capture data outside mutable save input", () => {
		expect(
			SaveFavoriteSchema.safeParse({ expectedRevision: 0, note: "界".repeat(21845) }).success,
		).toBe(true);
		expect(
			SaveFavoriteSchema.safeParse({ expectedRevision: 0, note: "界".repeat(21846) }).success,
		).toBe(false);
		expect(
			SaveFavoriteSchema.safeParse({ expectedRevision: 0, snapshot: { title: "forged" } }).success,
		).toBe(false);
	});
	it("retains authored note, exact preview and order in a private revision", () => {
		const snapshot = {
			targetUnitId: "019b76da-a800-7250-8000-000000000001",
			position: "a0",
			note: "Read chapter 2 again",
			preview: {
				title: "Captured title",
				summary: null,
				language: "en",
				capturedAt: "2026-09-07T00:00:00.000Z",
			},
		};
		expect(FavoriteSnapshotSchema.parse(snapshot)).toEqual(snapshot);
		expect(
			FavoriteSnapshotSchema.safeParse({
				...snapshot,
				preview: { ...snapshot.preview, capturedAt: "yesterday" },
			}).success,
		).toBe(false);
	});
});
