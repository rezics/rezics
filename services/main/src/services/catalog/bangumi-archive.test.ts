import { describe, expect, it } from "vitest";
import { catalogJsonLines, parseBangumiArchiveRecord } from "./bangumi-archive";

describe("bounded Archive record transport", () => {
	it("keeps exact UTF-8 across byte boundaries, CRLF and unterminated final records", async () => {
		const bytes = Buffer.from('{"name":"书"}\r\n{"id":2}');
		async function* input() {
			yield bytes.subarray(0, 11);
			yield bytes.subarray(11, 12);
			yield bytes.subarray(12);
		}
		const rows = await Array.fromAsync(catalogJsonLines(input()));
		expect(rows.map((row) => [row.line, row.bytes.toString("utf8")])).toEqual([
			[1, '{"name":"书"}'],
			[2, '{"id":2}'],
		]);
	});
	it("rejects oversized records and honours cancellation before consuming another chunk", async () => {
		async function* large() {
			yield Buffer.alloc(8_000_001, 32);
		}
		await expect(Array.fromAsync(catalogJsonLines(large()))).rejects.toThrow("record budget");
		const controller = new AbortController();
		controller.abort(new Error("stopped"));
		async function* one() {
			yield Buffer.from("{}\n");
		}
		await expect(Array.fromAsync(catalogJsonLines(one(), controller.signal))).rejects.toThrow(
			"stopped",
		);
	});
	it("does not coerce API-shaped episodes or merge distinct contextual relation tuples", () => {
		const first = { person_id: 2, subject_id: 3, character_id: 4, type: 0, summary: "" };
		expect(
			parseBangumiArchiveRecord("person-characters", Buffer.from(JSON.stringify(first))).externalId,
		).not.toBe(
			parseBangumiArchiveRecord(
				"person-characters",
				Buffer.from(JSON.stringify({ ...first, subject_id: 5 })),
			).externalId,
		);
		expect(() =>
			parseBangumiArchiveRecord("episode", Buffer.from('{"id":2,"desc":"API"}')),
		).toThrow();
	});
});
