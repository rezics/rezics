import { describe, expect, it } from "vitest";
import { openLibraryAcquisitionDescriptor } from "./openlibrary-acquisition";

describe("Open Library exact demand acquisition", () => {
	it.each([
		["work", "/works/OL1W", { type: { key: "/type/work" }, title: "Work" }],
		["edition", "/books/OL1M", { type: { key: "/type/edition" }, title: "Edition" }],
		["author", "/authors/OL1A", { type: { key: "/type/author" }, name: "Author" }],
	])("keeps the exact %s identity and unknown evidence", (kind, key, fields) => {
		const descriptor = openLibraryAcquisitionDescriptor(kind, key);
		expect(descriptor.url).toBe(`https://openlibrary.org${key}.json`);
		const record = { ...fields, key, futureField: "retained in archive" };
		expect(descriptor.parse(record)).toEqual(record);
		expect(descriptor.authoritativeGone).toBe(false);
	});
	it("rejects URL injection, cross-grain keys and redirected identities", () => {
		for (const key of ["https://attacker.test/works/OL1W", "/works/OL1W/../../admin", "/works/OL1W?x=1"])
			expect(() => openLibraryAcquisitionDescriptor("work", key)).toThrow();
		expect(() => openLibraryAcquisitionDescriptor("edition", "/works/OL1W")).toThrow();
		expect(() => openLibraryAcquisitionDescriptor("work", "/works/OL1W").parse({
			key: "/works/OL2W", type: { key: "/type/work" }, title: "Redirect",
		})).toThrow("another identity");
	});
});
