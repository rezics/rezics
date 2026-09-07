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

describe("owner-local native application history", () => {
	it("keeps shared owner histories and software child heads exact", () => {
		expect(
			CatalogSourceNativeChangesSchema.parse([
				{
					kind: "catalog-name",
					owner: "software",
					ownerId,
					componentKey: ownerId,
					beforeRevision: 1,
					afterRevision: 2,
				},
				{
					kind: "catalog-semantic",
					owner: "software",
					ownerId,
					componentKey: ownerId,
					beforeRevision: null,
					afterRevision: 1,
				},
				{
					kind: "software-context",
					ownerId,
					componentKey: ownerId,
					beforeRevision: 1,
					afterRevision: 2,
				},
				{
					kind: "software-participation",
					ownerId,
					componentKey: ownerId,
					beforeRevision: 1,
					afterRevision: 2,
				},
			]),
		).toHaveLength(4);
		expect(
			CatalogSourceNativeChangesSchema.safeParse([
				{
					kind: "catalog-name",
					owner: "unknown",
					ownerId,
					componentKey: ownerId,
					beforeRevision: 1,
					afterRevision: 2,
				},
			]).success,
		).toBe(false);
	});
	it("rejects nonadvancing heads and duplicate exact owner components", () => {
		const name = {
			kind: "catalog-name",
			owner: "entity",
			ownerId,
			componentKey: ownerId,
			beforeRevision: 2,
			afterRevision: 2,
		};
		expect(CatalogSourceNativeChangesSchema.safeParse([name]).success).toBe(false);
		expect(
			CatalogSourceNativeChangesSchema.safeParse([
				{ ...name, afterRevision: 3 },
				{ ...name, afterRevision: 4 },
			]).success,
		).toBe(false);
	});
});
