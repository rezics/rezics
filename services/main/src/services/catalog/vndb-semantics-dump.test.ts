import { describe, expect, it } from "vitest";
import { normalizeVndbSemanticDump } from "./vndb-semantics-dump";

describe("VNDB public dump semantic normalization", () => {
	it("normalizes public tag columns without projecting private or cached fields", () => {
		const raw = {
			id: "g1",
			name: "Mystery",
			cat: "cont",
			alias: "Enigma\nMystère",
			description: "Investigating an unexplained event",
			defaultspoil: 1,
			searchable: true,
			applicable: false,
			c_items: 42,
			hidden: false,
			vn_count: 100,
			aliases: ["untrusted normalized field"],
			category: "ero",
			parents: [
				{ id: "g1", parent: "g2", main: true },
				{ id: "g1", parent: "g3", main: false },
			],
		};
		const { record, parents, sourcePath } = normalizeVndbSemanticDump("tag", raw);
		expect(record).toEqual({
			objectType: "tag",
			id: "g1",
			name: "Mystery",
			category: "cont",
			aliases: ["Enigma", "Mystère"],
			description: "Investigating an unexplained event",
			defaultspoil: 1,
			searchable: true,
			applicable: false,
		});
		expect(parents).toEqual(raw.parents);
		expect(sourcePath("/aliases/0")).toBe("/alias");
		expect(sourcePath("/aliases/1")).toBe("/alias");
		expect(sourcePath("/category")).toBe("/cat");
		expect(sourcePath("/parents/1/main")).toBe("/parents/1/main");
		expect(sourcePath("/aliasesExtra/0")).toBe("/aliasesExtra/0");
		expect(raw.alias).toBe("Enigma\nMystère");
		expect(raw.c_items).toBe(42);
	});
	it("retains nullable trait groups, group ordering and separate hierarchy edges", () => {
		const { record, sourcePath } = normalizeVndbSemanticDump("trait", {
			id: "i1",
			name: "Hair",
			alias: "",
			gid: null,
			gorder: -2,
			sexual: false,
		});
		expect(record).toMatchObject({ aliases: [], group_id: null, gorder: -2, sexual: false });
		expect(sourcePath("/group_id")).toBe("/gid");
		expect(sourcePath("/gorder")).toBe("/gorder");
		expect(
			normalizeVndbSemanticDump("trait", { id: "i2", name: "Long hair", gid: "i1" }).record,
		).toMatchObject({ group_id: "i1" });
	});
	it("retains quote participants and signed score with exact dump pointers", () => {
		const { record, sourcePath } = normalizeVndbSemanticDump("quote", {
			id: "q1",
			vid: "v2",
			cid: "c3",
			quote: "The journey continues.",
			score: -4,
			vn: { id: "v999" },
			hidden: false,
		});
		expect(record).toEqual({
			objectType: "quote",
			id: "q1",
			vn: { id: "v2" },
			character: { id: "c3" },
			quote: "The journey continues.",
			score: -4,
		});
		expect(sourcePath("/vn/id")).toBe("/vid");
		expect(sourcePath("/character/id")).toBe("/cid");
		expect(
			normalizeVndbSemanticDump("quote", { id: "q2", vid: "v2", cid: null, quote: "Text" }).record,
		).toMatchObject({ character: null });
	});
	it("retains all eight DRM flags and numeric engine identities", () => {
		expect(
			normalizeVndbSemanticDump("drm", {
				id: 3,
				name: "Disc check",
				description: "Disc required",
				disc: true,
				cdkey: false,
				activate: true,
				alimit: false,
				account: true,
				online: false,
				cloud: false,
				physical: true,
				c_ref: 123,
				state: 1,
			}).record,
		).toEqual({
			objectType: "drm",
			id: 3,
			name: "Disc check",
			description: "Disc required",
			disc: true,
			cdkey: false,
			activate: true,
			alimit: false,
			account: true,
			online: false,
			cloud: false,
			physical: true,
		});
		expect(normalizeVndbSemanticDump("engine", { id: 4, name: "Engine", c_ref: 1 }).record).toEqual(
			{ objectType: "engine", id: 4, name: "Engine" },
		);
	});
	it.each([
		{ id: "i1", name: "wrong family" },
		{ id: "g1", name: "bad alias", alias: ["alias"] },
		{ id: "g1", name: "bad category", cat: "invalid" },
		{ id: "g1", name: "wrong declaration", objectType: "trait" },
		{ id: "g1", name: "wrong child", parents: [{ id: "g2", parent: "g3", main: false }] },
		{ id: "g1", name: "wrong parent", parents: [{ id: "g1", parent: "i2", main: false }] },
		{ id: "g1", name: "self parent", parents: [{ id: "g1", parent: "g1", main: false }] },
		{ id: "g1", name: "missing flag", parents: [{ id: "g1", parent: "g2" }] },
		{
			id: "g1",
			name: "duplicate",
			parents: [
				{ id: "g1", parent: "g2", main: false },
				{ id: "g1", parent: "g2", main: true },
			],
		},
	])("rejects malformed tag dumps: $name", (input) => {
		expect(() => normalizeVndbSemanticDump("tag", input)).toThrow();
	});
	it("rejects malformed quote references and numeric family identities", () => {
		expect(() =>
			normalizeVndbSemanticDump("quote", { id: "q1", vid: "c2", quote: "Text" }),
		).toThrow();
		expect(() =>
			normalizeVndbSemanticDump("quote", { id: "q1", vid: "v2", cid: "v3", quote: "Text" }),
		).toThrow();
		expect(() => normalizeVndbSemanticDump("engine", { id: "4", name: "Engine" })).toThrow();
		expect(() =>
			normalizeVndbSemanticDump("engine", {
				id: 4,
				name: "Engine",
				parents: [{ id: "g1", parent: "g2", main: false }],
			}),
		).toThrow();
		expect(() => normalizeVndbSemanticDump("drm", { id: 1, name: "Incomplete flags" })).toThrow();
	});
	it("enforces bounded parent and alias fan-out", () => {
		expect(() =>
			normalizeVndbSemanticDump("tag", {
				id: "g1",
				name: "Too many aliases",
				alias: Array.from({ length: 513 }, (_, i) => `alias${i}`).join("\n"),
			}),
		).toThrow();
		expect(() =>
			normalizeVndbSemanticDump("tag", {
				id: "g1",
				name: "Too many parents",
				parents: Array.from({ length: 513 }, (_, i) => ({
					id: "g1",
					parent: `g${i + 2}`,
					main: false,
				})),
			}),
		).toThrow();
	});
});
