import { describe, expect, it } from "vitest";

import { InvalidTagPath } from "../api/tags/errors";
import { paginateAcceptedTagPathCandidates, toTagPathConstraintError } from "./service";

const candidate = (index: number, accepted = true) => ({
	pathId: `path-${index}`,
	score: accepted ? 1 : 0,
	usageCount: 0,
	voteCount: accepted ? 1 : 0,
});

describe("Tag Path constraint errors", () => {
	it("maps rejected definitions and immutable projection writes to the public error", () => {
		expect(
			toTagPathConstraintError({
				cause: {
					code: "23514",
					constraint: "tag_path_member_count_check",
					message:
						'new row for relation "tag_path" violates check constraint "tag_path_member_count_check"',
				},
			}),
		).toBeInstanceOf(InvalidTagPath);
		expect(
			toTagPathConstraintError({
				cause: {
					code: "23514",
					constraint: "tag_path_member_projection_only",
					message: "tag_path_member is a rebuildable Tag Path projection",
				},
			}),
		).toBeInstanceOf(InvalidTagPath);
	});

	it("does not relabel unrelated database failures", () => {
		expect(
			toTagPathConstraintError({
				code: "23514",
				message: "unrelated domain constraint",
			}),
		).toBeUndefined();
		expect(toTagPathConstraintError(new Error("unrelated"))).toBeUndefined();
	});

	it("advances bounded accepted-Path scans without skipping accepted candidates", () => {
		const full = paginateAcceptedTagPathCandidates({
			candidates: Array.from({ length: 65 }, (_, index) => candidate(index)),
			itemLimit: 50,
			scanLimit: 64,
		});
		expect(full.pageRows).toHaveLength(50);
		expect(full.nextCursor).toBe("path-49");

		const sparse = paginateAcceptedTagPathCandidates({
			candidates: Array.from({ length: 65 }, (_, index) =>
				candidate(index, index === 2 || index === 60),
			),
			itemLimit: 50,
			scanLimit: 64,
		});
		expect(sparse.pageRows.map(({ pathId }) => pathId)).toEqual(["path-2", "path-60"]);
		expect(sparse.nextCursor).toBe("path-63");

		expect(
			paginateAcceptedTagPathCandidates({
				candidates: sparse.pageRows,
				itemLimit: 50,
				scanLimit: 64,
			}).nextCursor,
		).toBeNull();
	});
});
