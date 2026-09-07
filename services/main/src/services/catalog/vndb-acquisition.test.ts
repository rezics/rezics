import { describe, expect, it } from "vitest";
import {
	vndbAcquisitionRequest,
	VndbAcquisitionFields,
	vndbRequiredStaffDependencies,
} from "./vndb-acquisition";

describe("VNDB complete principal acquisition descriptors", () => {
	it("allows only eight fixed families with exact matching identities", () => {
		for (const [family, id] of [
			["vn", "v1"],
			["release", "r1"],
			["staff", "s1"],
			["producer", "p1"],
			["character", "c1"],
			["tag", "g1"],
			["trait", "i1"],
			["quote", "q1"],
		] as const) {
			const request = vndbAcquisitionRequest(family, id);
			expect(request.url).toBe(`https://api.vndb.org/kana/${family}`);
			expect(JSON.parse(request.body)).toMatchObject({
				filters:
					family === "staff" ? ["and", ["id", "=", id], ["ismain", "=", 1]] : ["id", "=", id],
				results: 1,
			});
		}
		expect(() => vndbAcquisitionRequest("../private", "v1")).toThrow();
		expect(() => vndbAcquisitionRequest("staff", "v1")).toThrow();
		expect(() => vndbAcquisitionRequest("vn", "v0")).toThrow();
	});
	it("retains alias keys and edge-local fields without recursively expanding all related principals", () => {
		expect(VndbAcquisitionFields.vn).toContain("staff{id,aid,eid,role,note}");
		expect(VndbAcquisitionFields.staff).toContain("aliases{aid,name,latin,ismain}");
		expect(VndbAcquisitionFields.release).toContain("vns{id,rtype}");
		expect(VndbAcquisitionFields.character).toContain("vns{id,role,spoiler,release.id}");
		expect(
			vndbRequiredStaffDependencies({
				id: "v1",
				title: "VN",
				staff: [{ id: "s2", aid: 3, eid: null, role: "staff", note: null }],
				va: [{ staff: { id: "s2", aid: 4 }, character: { id: "c1" }, note: null }],
			}),
		).toEqual([{ source: "vndb", objectType: "staff", externalId: "s2" }]);
	});
	it("rejects missing rows, pagination and mismatched records as failures, never tombstones", () => {
		const request = vndbAcquisitionRequest("vn", "v1");
		expect(() => request.parse({ results: [], more: false })).toThrow();
		expect(() => request.parse({ results: [{ id: "v2", title: "Wrong" }], more: false })).toThrow();
		expect(() => request.parse({ results: [{ id: "v1", title: "VN" }], more: true })).toThrow();
		expect(request.parse({ results: [{ id: "v1", title: "VN" }], more: false }).id).toBe("v1");
	});
});
