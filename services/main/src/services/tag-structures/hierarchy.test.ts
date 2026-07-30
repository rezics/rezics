import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.hoisted(() => vi.fn());

vi.mock("../database", () => ({
	database: { select },
}));

import { TagNotFound } from "../api/tags/errors";
import { getTagHierarchy } from "./service";

const TagId = "019fb1ef-a9b2-7a98-8d45-770b04760100";

function rootTagSelect(rows: readonly { id: string }[]) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				limit: vi.fn(async () => rows),
			})),
		})),
	};
}

function hierarchyEdgeSelect(rows: readonly object[]) {
	return {
		from: vi.fn(() => ({
			innerJoin: vi.fn(() => ({
				innerJoin: vi.fn(() => ({
					where: vi.fn(async () => rows),
				})),
			})),
		})),
	};
}

function hierarchyLocalizationSelect(
	rows: readonly {
		tagId: string;
		language: "en" | null;
		title: string | null;
		summary: string | null;
	}[],
) {
	return {
		from: vi.fn(() => ({
			where: vi.fn(async () => rows),
		})),
	};
}

describe("Tag hierarchy authorization", () => {
	beforeEach(() => {
		select.mockReset();
	});

	it("maps a denied Unit read to TagNotFound before querying Tag data", async () => {
		const authorization = {
			ensureCanRead: vi.fn(
				async (_unitId: string, onDenied: () => TagNotFound): Promise<void> => {
					throw onDenied();
				},
			),
		};

		await expect(
			getTagHierarchy({
				tagId: TagId,
				authorization,
				childLimit: 30,
				grandchildLimit: 12,
			}),
		).rejects.toBeInstanceOf(TagNotFound);
		expect(authorization.ensureCanRead).toHaveBeenCalledWith(TagId, expect.any(Function));
		expect(select).not.toHaveBeenCalled();
	});

	it("loads a readable Tag without imposing a second public-lifecycle gate", async () => {
		const authorization = {
			ensureCanRead: vi.fn(async (): Promise<void> => undefined),
		};
		select
			.mockImplementationOnce(() => rootTagSelect([{ id: TagId }]))
			.mockImplementationOnce(() => hierarchyEdgeSelect([]))
			.mockImplementationOnce(() =>
				hierarchyLocalizationSelect([
					{
						tagId: TagId,
						language: "en",
						title: "Readable draft Tag",
						summary: "Visible through the Unit read policy.",
					},
				]),
			);

		await expect(
			getTagHierarchy({
				tagId: TagId,
				authorization,
				localizationLanguages: ["en"],
				childLimit: 30,
				grandchildLimit: 12,
			}),
		).resolves.toEqual({
			tagId: TagId,
			language: "en",
			title: "Readable draft Tag",
			summary: "Visible through the Unit read policy.",
			children: [],
		});
		expect(authorization.ensureCanRead).toHaveBeenCalledWith(TagId, expect.any(Function));
		expect(select).toHaveBeenCalledTimes(3);
	});
});
