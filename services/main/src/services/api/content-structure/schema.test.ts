import { Value } from "@sinclair/typebox/value";
import { createPortableTextDocument } from "@rezics/block";
import { describe, expect, it } from "vitest";

import {
	SaveBookContentStructureDraftBody,
	SaveMediaContentStructureDraftBody,
	UpdateContentStructureNodesBatchBody,
} from "./schema";

const uuid = (index: number) => `019b1234-1234-7000-8000-${index.toString(16).padStart(12, "0")}`;

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

	it("accepts an optional Chapter ownership override", () => {
		const node = {
			state: "new",
			id: "018ff2b7-7c00-7000-8000-000000000002",
			parentId: null,
			order: 0,
			title: "Chapter",
			language: "en",
			contentKind: "chapter",
			content: createPortableTextDocument([]),
			status: "draft",
		} as const;

		expect(
			Value.Check(SaveBookContentStructureDraftBody, {
				baseRevisionId: "018ff2b7-7c00-7000-8000-000000000001",
				nodes: [node],
			}),
		).toBe(true);
		expect(
			Value.Check(SaveBookContentStructureDraftBody, {
				baseRevisionId: "018ff2b7-7c00-7000-8000-000000000001",
				nodes: [{ ...node, ownershipMode: "community_owned" }],
			}),
		).toBe(true);
		expect(
			Value.Check(SaveBookContentStructureDraftBody, {
				baseRevisionId: "018ff2b7-7c00-7000-8000-000000000001",
				nodes: [{ ...node, ownershipMode: "invalid" }],
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

	it("does not impose the batch-command limit on a complete aggregate", () => {
		expect(
			Value.Check(SaveBookContentStructureDraftBody, {
				baseRevisionId: uuid(1),
				nodes: Array.from({ length: 10_001 }, (_, index) => ({
					state: "existing",
					id: uuid(index + 2),
					parentId: null,
					order: index,
					title: `Node ${index}`,
				})),
			}),
		).toBe(true);
	});

	it("limits only the number of explicit batch commands", () => {
		const base = {
			baseRevisionId: uuid(1),
			changes: Array.from({ length: 10_001 }, (_, index) => ({
				opId: String(index),
				type: "node.deleteSubtree",
				nodeId: uuid(index + 2),
			})),
		};
		expect(Value.Check(UpdateContentStructureNodesBatchBody, base)).toBe(false);
		expect(
			Value.Check(UpdateContentStructureNodesBatchBody, {
				baseRevisionId: uuid(1),
				changes: base.changes.slice(0, 10_000),
			}),
		).toBe(true);
	});
});
