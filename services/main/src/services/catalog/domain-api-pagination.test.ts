import { describe, expect, it } from "vitest";
import { z } from "zod";
import { domainPage, decodeDomainCursor } from "./domain-api-pagination";
describe("bounded native domain wire pages", () => {
	it("retains a continuation when the byte budget truncates an otherwise bounded page", () => {
		const page = domainPage(
			"program/a",
			[
				{ id: 1, value: "x".repeat(1_100_000) },
				{ id: 2, value: "y".repeat(1_100_000) },
			],
			10,
			(row) => row.id,
		);
		expect(page.items).toHaveLength(1);
		expect(page.nextCursor).not.toBeNull();
		expect(decodeDomainCursor("program/a", page.nextCursor ?? undefined, z.number())).toBe(1);
	});
	it("rejects malformed values and cross-owner continuation without treating cursors as authority", () => {
		expect(() => decodeDomainCursor("program/a", "AAAA", z.uuid())).toThrow(TypeError);
		const cursor = domainPage("program/a", [{ id: "x" }], 1, (row) => row.id).nextCursor;
		expect(() => decodeDomainCursor("program/b", cursor ?? undefined, z.string())).toThrow(
			/another/,
		);
		expect(() => decodeDomainCursor("program/a", cursor ?? undefined, z.uuid())).toThrow(/value/);
	});
});
