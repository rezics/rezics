import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.hoisted(() => vi.fn());
const execute = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({ database: { execute, select } }));

import { TagNotFound } from "../api/tags/errors";
import { getTagHierarchy } from "./service";

const TagId = "019fb1ef-a9b2-7a98-8d45-770b04760100";

function rootTagSelect(rows: readonly { id: string }[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(async () => rows),
		})),
	};
}

function relationSelect(rows: readonly object[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				orderBy: vi.fn(() => ({ limit: vi.fn(async () => rows) })),
			})),
		})),
	};
}

function nodeSelect(rows: readonly object[]) {
	return {
		from: vi.fn(() => ({
			leftJoin: vi.fn(() => ({
				where: vi.fn(async () => rows),
			})),
		})),
	};
}

describe("Tag hierarchy semantics", () => {
	beforeEach(() => {
		select.mockReset();
		execute.mockReset();
		execute.mockResolvedValue({ rows: [] });
	});

	it("rejects an unknown root concept", async () => {
		select.mockImplementationOnce(() => rootTagSelect([]));

		await expect(
			getTagHierarchy({ tagId: TagId, childLimit: 30, grandchildLimit: 12 }),
		).rejects.toBeInstanceOf(TagNotFound);
		expect(select).toHaveBeenCalledTimes(1);
	});

	it("returns typed relations to both concept and guide nodes", async () => {
		const nodeId = "019fb1ef-a9b2-7a98-8d45-770b04760102";
		const relations = [
			{
				relationId: "019fb1ef-a9b2-7a98-8d45-770b04760101",
				relationKind: "organizational" as const,
				nodeId,
			},
		];
		select
			.mockImplementationOnce(() => rootTagSelect([{ id: TagId }]))
			.mockImplementationOnce(() => relationSelect(relations))
			.mockImplementationOnce(() =>
				nodeSelect([
					{
						nodeId,
						nodeKind: "guide",
						language: null,
						tagTitle: null,
						guideTitle: "Appearance",
						summary: null,
						avatar: null,
					},
				]),
			);

		await expect(
			getTagHierarchy({
				tagId: TagId,
				localizationLanguages: ["en"],
				childLimit: 30,
				grandchildLimit: 12,
			}),
		).resolves.toEqual({
			tagId: TagId,
			children: [
				{
					relationId: relations[0]?.relationId,
					relationKind: "organizational",
					node: {
						nodeId,
						nodeKind: "guide",
						language: null,
						title: "Appearance",
						summary: null,
						avatar: null,
					},
					children: [],
				},
			],
		});
		expect(select).toHaveBeenCalledTimes(3);
		expect(execute).toHaveBeenCalledTimes(1);
	});
});
