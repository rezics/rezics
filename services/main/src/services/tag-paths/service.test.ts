import { describe, expect, it } from "vitest";

import { InvalidTagPath } from "../api/tags/errors";
import { toTagPathConstraintError } from "./service";

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
					code: "55000",
					message: "Tag hierarchy path definitions are immutable",
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
});
