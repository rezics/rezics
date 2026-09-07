import { describe, expect, it } from "vitest";
import { CatalogSourceNativeChangesSchema } from "./source-applications";

const ownerId = "01900000-0000-7000-8000-000000000001";
const music = {
	kind: "music-component",
	ownerId,
	component: "music_medium",
	componentKey: ownerId,
	beforeRevisionId: null,
	afterRevisionId: "01900000-0000-7000-8000-000000000002",
} as const;

describe("native source application manifest", () => {
	it("keeps distinct native history key types and supports creation and compensation evidence", () => {
		expect(
			CatalogSourceNativeChangesSchema.parse([
				music,
				{ kind: "software-record", ownerId, beforeRevision: 1, afterRevision: 2 },
			]),
		).toHaveLength(2);
		expect(
			CatalogSourceNativeChangesSchema.safeParse([{ ...music, afterRevisionId: 2 }]).success,
		).toBe(false);
	});
	it("rejects duplicate native components and prevents an unbounded transaction manifest", () => {
		expect(CatalogSourceNativeChangesSchema.safeParse([music, music]).success).toBe(false);
		expect(
			CatalogSourceNativeChangesSchema.safeParse(
				Array.from({ length: 129 }, (_, i) => ({ ...music, componentKey: String(i) })),
			).success,
		).toBe(false);
	});
	it("distinguishes component families and rejects source payloads as native history", () => {
		expect(
			CatalogSourceNativeChangesSchema.safeParse([{ ...music, sourcePayload: { raw: true } }])
				.success,
		).toBe(false);
		expect(
			CatalogSourceNativeChangesSchema.parse([
				music,
				{ ...music, component: "music_track_occurrence" },
			]),
		).toHaveLength(2);
	});
});
