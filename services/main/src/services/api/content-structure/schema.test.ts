import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { SaveBookContentStructureDraftBody, SaveMediaContentStructureDraftBody } from "./schema";

describe("Content Structure API schemas", () => {
	it("accepts an attached Unit reference without client-owned presentation", () => {
		const body = {
			baseRevisionId: "018ff2b7-7c00-7000-8000-000000000001",
			nodes: [
				{
					state: "attached",
					id: "018ff2b7-7c00-7000-8000-000000000002",
					parentId: null,
					order: 0,
					contentUnitId: "018ff2b7-7c00-7000-8000-000000000003",
				},
			],
		};

		expect(Value.Check(SaveBookContentStructureDraftBody, body)).toBe(true);
		expect(
			Value.Check(SaveBookContentStructureDraftBody, {
				...body,
				nodes: [{ ...body.nodes[0], title: "Untrusted title" }],
			}),
		).toBe(false);
	});

	it("accepts new Video and Audio Units with title-only metadata", () => {
		const base = {
			kind: "revision",
			revisionId: "018ff2b7-7c00-7000-8000-000000000001",
		} as const;
		const common = {
			state: "new",
			parentId: null,
			order: 0,
			title: "Timed item",
			language: "en",
		} as const;
		expect(
			Value.Check(SaveMediaContentStructureDraftBody, {
				base,
				nodes: [
					{
						...common,
						id: "018ff2b7-7c00-7000-8000-000000000002",
						contentKind: "video",
					},
					{
						...common,
						id: "018ff2b7-7c00-7000-8000-000000000003",
						contentKind: "audio",
					},
				],
			}),
		).toBe(true);
		expect(
			Value.Check(SaveMediaContentStructureDraftBody, {
				base,
				nodes: [
					{
						...common,
						id: "018ff2b7-7c00-7000-8000-000000000002",
						contentKind: "chapter",
					},
				],
			}),
		).toBe(false);
	});

	it("keeps first-save and revision bases mutually exclusive", () => {
		expect(
			Value.Check(SaveMediaContentStructureDraftBody, {
				base: { kind: "uninitialized" },
				nodes: [],
			}),
		).toBe(true);
		expect(
			Value.Check(SaveMediaContentStructureDraftBody, {
				base: {
					kind: "revision",
					revisionId: "018ff2b7-7c00-7000-8000-000000000001",
				},
				nodes: [],
			}),
		).toBe(true);
		expect(
			Value.Check(SaveMediaContentStructureDraftBody, {
				base: {
					kind: "uninitialized",
					revisionId: "018ff2b7-7c00-7000-8000-000000000001",
				},
				nodes: [],
			}),
		).toBe(false);
		expect(
			Value.Check(SaveMediaContentStructureDraftBody, {
				base: { kind: "revision" },
				nodes: [],
			}),
		).toBe(false);
	});
});
