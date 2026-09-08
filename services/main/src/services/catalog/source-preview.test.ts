import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	previewCatalogSourceChanges,
	previewCatalogSourceValue,
	SourcePreviewNodeLimit,
} from "./source-preview";

function bytes(value: unknown) {
	return Buffer.from(JSON.stringify(value));
}
function digest(text: string) {
	return createHash("sha256").update(text).digest("hex");
}

describe("source proposal preview", () => {
	it("continues a bounded change cursor without drops or duplicates", () => {
		const before: Record<string, number> = {};
		const after: Record<string, number> = {};
		for (let index = 0; index < 40; index++) {
			const key = `k${String(index).padStart(2, "0")}`;
			before[key] = 0;
			after[key] = 1;
		}
		const seen = new Set<string>();
		const positions: number[] = [];
		let afterPosition = -1;
		for (let page = 0; page < 16; page++) {
			const result = previewCatalogSourceChanges(bytes(before), bytes(after), {
				afterPosition,
				limit: 7,
			});
			expect(result.changes.length).toBeLessThanOrEqual(7);
			for (const change of result.changes) {
				expect(seen.has(change.path)).toBe(false);
				seen.add(change.path);
				positions.push(change.position);
			}
			if (result.afterPosition === null) break;
			expect(result.afterPosition).toBe(result.changes.at(-1)?.position);
			afterPosition = result.afterPosition;
		}
		expect(seen.size).toBe(40);
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
		expect(new Set(positions).size).toBe(40);
		expect(positions[0]).toBe(0);
		expect(positions.at(-1)).toBe(39);
	});

	it("encodes and decodes escaped JSON pointer keys", () => {
		const before = { "a/b": "old", "a~b": 1, "a~/b": false };
		const after = { "a/b": "new", "a~b": 2, "a~/b": true };
		const result = previewCatalogSourceChanges(bytes(before), bytes(after), { limit: 10 });
		expect(result.changes.map((change) => change.path)).toEqual(["/a~1b", "/a~0~1b", "/a~0b"]);
		const slash = result.changes.find((change) => change.path === "/a~1b");
		expect(slash?.before?.text).toBe(JSON.stringify("old"));
		expect(slash?.after?.text).toBe(JSON.stringify("new"));
		const tildeSlash = previewCatalogSourceValue(bytes(after), {
			side: "after",
			path: "/a~0~1b",
		});
		expect(tildeSlash.kind).toBe("boolean");
		expect(tildeSlash.text).toBe("true");
		expect(() =>
			previewCatalogSourceValue(bytes(after), { side: "after", path: "/a~2b" }),
		).toThrow(/escape/u);
		expect(() =>
			previewCatalogSourceValue(bytes(after), { side: "after", path: "/a~" }),
		).toThrow(/escape/u);
	});

	it("reconstructs a long value from chunks and keeps the full-text hash", () => {
		const value = "x".repeat(20_000);
		const document = { title: value };
		const encoded = JSON.stringify(value);
		const sha256 = digest(encoded);
		const listed = previewCatalogSourceChanges(bytes({ title: "short" }), bytes(document), {
			limit: 10,
		});
		const change = listed.changes.find((item) => item.path === "/title");
		expect(change?.after?.complete).toBe(false);
		expect(change?.after?.text).toBe(encoded.slice(0, 2048));
		expect(change?.after?.sha256).toBe(sha256);
		let offset = 0;
		let reconstructed = "";
		for (let page = 0; page < 8; page++) {
			const chunk = previewCatalogSourceValue(bytes(document), {
				side: "after",
				path: "/title",
				offset,
				limit: 8192,
			});
			expect(chunk.kind).toBe("string");
			expect(chunk.sha256).toBe(sha256);
			expect(chunk.text.length).toBeLessThanOrEqual(8192);
			reconstructed += chunk.text;
			if (chunk.afterOffset === null) break;
			expect(chunk.afterOffset).toBe(offset + chunk.text.length);
			offset = chunk.afterOffset;
		}
		expect(reconstructed).toBe(encoded);
		expect(digest(reconstructed)).toBe(sha256);
	});

	it("distinguishes missing from null and empty object from empty array", () => {
		const missing = previewCatalogSourceChanges(bytes({ a: 1 }), bytes({}), { limit: 10 });
		expect(missing.changes).toEqual([
			expect.objectContaining({ path: "/a", before: expect.objectContaining({ kind: "number" }), after: null }),
		]);
		const nulled = previewCatalogSourceChanges(bytes({ a: 1 }), bytes({ a: null }), { limit: 10 });
		expect(nulled.changes[0]?.after).toEqual(
			expect.objectContaining({ kind: "null", text: "null", complete: true }),
		);
		expect(nulled.changes[0]?.after).not.toBeNull();
		expect(
			previewCatalogSourceChanges(bytes({}), bytes({}), { limit: 10 }).changes,
		).toEqual([]);
		expect(
			previewCatalogSourceChanges(bytes([]), bytes([]), { limit: 10 }).changes,
		).toEqual([]);
		const kindChange = previewCatalogSourceChanges(bytes({}), bytes([]), { limit: 10 });
		expect(kindChange.changes).toHaveLength(1);
		expect(kindChange.changes[0]?.path).toBe("");
		expect(kindChange.changes[0]?.before?.kind).toBe("object");
		expect(kindChange.changes[0]?.after?.kind).toBe("array");
		const emptyAdded = previewCatalogSourceChanges(bytes({}), bytes({ a: {} }), { limit: 10 });
		expect(emptyAdded.changes[0]?.path).toBe("/a");
		expect(emptyAdded.changes[0]?.before).toBeNull();
		expect(emptyAdded.changes[0]?.after?.kind).toBe("object");
		expect(emptyAdded.changes[0]?.after?.text).toBe("{}");
		expect(
			previewCatalogSourceChanges(bytes({ a: {} }), bytes({ a: {} }), { limit: 10 }).changes,
		).toEqual([]);
		const emptyArraySwap = previewCatalogSourceChanges(bytes({ a: {} }), bytes({ a: [] }), {
			limit: 10,
		});
		expect(emptyArraySwap.changes[0]?.before?.kind).toBe("object");
		expect(emptyArraySwap.changes[0]?.after?.kind).toBe("array");
	});

	it("rejects documents that exceed byte, depth, or node budgets", () => {
		expect(() =>
			previewCatalogSourceChanges(null, new Uint8Array(8_388_609), { limit: 1 }),
		).toThrow(/archive budget/u);
		let deep: unknown = 1;
		let deeper: unknown = 2;
		for (let depth = 0; depth < 65; depth++) {
			deep = { n: deep };
			deeper = { n: deeper };
		}
		expect(() => previewCatalogSourceChanges(bytes(deep), bytes(deeper), { limit: 1 })).toThrow(
			/structural budget/u,
		);
		const longKey = "k".repeat(4096);
		expect(() =>
			previewCatalogSourceChanges(bytes({}), bytes({ [longKey]: 1 }), { limit: 1 }),
		).toThrow(/bounded structural preview grammar/u);
		const wide = Array.from({ length: SourcePreviewNodeLimit }, () => 0);
		expect(() => previewCatalogSourceChanges(bytes({}), bytes(wide), { limit: 1 })).toThrow(
			/structural budget/u,
		);
		expect(() => previewCatalogSourceChanges(null, bytes(wide.slice(0, -1)), { limit: 1 })).not.toThrow();
		const deepPath = `/${Array.from({ length: 65 }, () => "n").join("/")}`;
		expect(() =>
			previewCatalogSourceValue(bytes({ n: 1 }), { side: "after", path: deepPath }),
		).toThrow(/too deep/u);
	}, 20_000);
});
