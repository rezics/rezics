import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseAggregateDriftCount } from "./reconcile-aggregates-result";

describe("aggregate reconciliation queries", () => {
	it("derives Favorites engagement from the current Profile relation", async () => {
		const source = await readFile(new URL("./reconcile-aggregates.ts", import.meta.url), "utf8");

		expect(source).toContain("join profile_favorites_collection favorites");
		expect(source).toContain("favorites.collection_id = item.collection_id");
		expect(source).not.toContain("owner.source");
		expect(source).not.toContain("owner.system_key");
	});

	it("reconciles exact Book Chapter totals and per-Profile completions", async () => {
		const source = await readFile(new URL("./reconcile-aggregates.ts", import.meta.url), "utf8");

		expect(source).toContain('name: "book_chapter_stats"');
		expect(source).toContain("full join book_chapter_stat");
		expect(source).toContain("full join book_chapter_progress_stat");
	});

	it("excludes notifications covered by the recipient read-through watermark", async () => {
		const source = await readFile(new URL("./reconcile-aggregates.ts", import.meta.url), "utf8");

		expect(source).toContain("notification_recipient_stat read_state");
		expect(source).toContain("notification.created_at > read_state.read_through_created_at");
		expect(source).toContain("notification.id > read_state.read_through_id");
	});
});

describe("aggregate reconciliation result parsing", () => {
	it("accepts exactly one nonnegative text count", () => {
		expect(parseAggregateDriftCount([{ drift_count: "2" }], "fixture")).toBe(2);
	});

	it.each([
		{ rows: [] },
		{ rows: [{ drift_count: "0" }, { drift_count: "1" }] },
		{ rows: [{}] },
		{ rows: [{ drift_count: 0 }] },
		{ rows: [{ drift_count: "-1" }] },
	])("fails closed for malformed rows: %j", ({ rows }) => {
		expect(() => parseAggregateDriftCount(rows, "fixture")).toThrow(
			/one result row|malformed drift count|negative drift count/,
		);
	});
});
