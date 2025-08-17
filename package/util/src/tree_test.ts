import { assertEquals } from "@std/assert";
import { flat, hierarchical, type HierarchicalTree } from "./tree.ts";

Deno.test("flat", () => {
	const hierarchical: HierarchicalTree = [{
		self: "A",
		children: [
			{ self: "B", children: [{ self: "C" }] },
			{ self: "D" },
		],
	}];
	assertEquals(flat(hierarchical), {
		"A": ["B", "D"],
		"B": ["C"],
	});
});

Deno.test("hierarchical", () => {
	const flat = {
		"A": ["B", "D"],
		"B": ["C"],
	};
	assertEquals(hierarchical(flat), [{
		self: "A",
		children: [
			{ self: "B", children: [{ self: "C" }] },
			{ self: "D" },
		],
	}]);
});

Deno.test("flat: empty hierarchical input", () => {
	assertEquals(flat([]), {});
});

Deno.test("flat: single node no children -> empty flat result", () => {
	assertEquals(flat([{ self: "Root" }]), {});
});

Deno.test("hierarchical: single node with empty children array", () => {
	assertEquals(hierarchical({ "Root": [] }), [
		{ self: "Root" },
	]);
});

Deno.test("hierarchical: shared child referenced by multiple parents", () => {
	const f = { A: ["B"], C: ["B"], B: [] as string[] };
	assertEquals(hierarchical(f), [
		{ self: "A", children: [{ self: "B" }] },
		{ self: "C", children: [{ self: "B" }] },
	]);
});

Deno.test("round-trip: hierarchical -> flat -> hierarchical (tree with unique parents)", () => {
	const h: HierarchicalTree = [{
		self: "A",
		children: [
			{ self: "B", children: [{ self: "C" }] },
			{ self: "D", children: [{ self: "E" }] },
		],
	}];
	const f = flat(h);
	assertEquals(hierarchical(f), h);
});

Deno.test("round-trip: flat -> hierarchical -> flat (nodes with children only)", () => {
	const f = {
		A: ["B", "D"],
		B: ["C"],
		D: ["E"],
		E: ["F"],
		F: [] as string[],
	};
	// Remove leaf-only nodes (those with empty children) for the expectation of flat();
	const expectedFlat = { A: ["B", "D"], B: ["C"], D: ["E"], E: ["F"] };
	const h = hierarchical(f);
	assertEquals(flat(h), expectedFlat);
});

Deno.test("flat: deep single chain only includes internal nodes", () => {
	const h: HierarchicalTree = [{
		self: "A",
		children: [{
			self: "B",
			children: [{ self: "C", children: [{ self: "D" }] }],
		}],
	}];
	assertEquals(flat(h), { A: ["B"], B: ["C"], C: ["D"] });
});

Deno.test("hierarchical: child missing explicit key becomes leaf", () => {
	// B is referenced but not declared as a key, should appear as leaf.
	assertEquals(hierarchical({ A: ["B"] }), [
		{ self: "A", children: [{ self: "B" }] },
	]);
});

Deno.test("hierarchical: preserves insertion order after filtering referenced roots", () => {
	const f = { Z: ["A"], A: ["B"], M: ["N"] };
	const h = hierarchical(f);
	// A is referenced by Z so it's not a root; order of remaining roots keeps original relative order.
	assertEquals(h.map((n) => n.self), ["Z", "M"]);
	assertEquals(h[0].children?.[0].self, "A");
});

Deno.test("flat: explicit empty children arrays are ignored in output", () => {
	const h: HierarchicalTree = [{
		self: "A",
		children: [{ self: "B", children: [] as any }],
	}];
	assertEquals(flat(h), { A: ["B"] });
});

Deno.test("hierarchical: duplicate child references kept (current behavior lock)", () => {
	const f = { A: ["B", "B"], B: [] as string[] };
	// B referenced twice, so A stays root; B filtered out from roots. Inside A we expect two B nodes.
	assertEquals(hierarchical(f), [
		{ self: "A", children: [{ self: "B" }, { self: "B" }] },
	]);
});

Deno.test("round-trip: repeated hierarchical->flat->hierarchical idempotent", () => {
	const f = { P: ["Q", "R"], Q: ["S"], R: [], S: [] };
	const h1 = hierarchical(f);
	const f1 = flat(h1); // leaves removed
	const h2 = hierarchical(f1);
	assertEquals(h2, h1.filter((n) => n.self === "P")); // Because leaves removed from flat()
});
