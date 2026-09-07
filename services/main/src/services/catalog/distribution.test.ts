import { describe, expect, it } from "vitest";
import {
	DistributionMemberBatchSchema,
	DistributionRevisionValuesSchema,
	DistributionTargetSchema,
} from "./distribution";

describe("provider-independent distribution contracts", () => {
	const target = { kind: "music_release", id: "01960000-0000-7000-8000-000000000001" };
	const row = {
		occurrenceId: "01960000-0000-7000-8000-000000000002",
		target,
		originalNumber: "Disc A",
		quantity: null,
	};
	it("retains repeated content as distinct occurrences and preserves unknown quantity", () => {
		const rows = DistributionMemberBatchSchema.parse([
			row,
			{
				...row,
				occurrenceId: "01960000-0000-7000-8000-000000000003",
				originalNumber: "Bonus A",
				quantity: 2,
			},
		]);
		expect(rows[0]?.quantity).toBeNull();
		expect(rows[1]?.quantity).toBe(2);
		expect(rows[1]?.originalNumber).toBe("Bonus A");
		expect(rows[0]?.target).toEqual(rows[1]?.target);
	});
	it("rejects duplicate occurrence identities, nonphysical quantities and oversized batches", () => {
		expect(DistributionMemberBatchSchema.safeParse([row, row]).success).toBe(false);
		for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
			expect(DistributionMemberBatchSchema.safeParse([{ ...row, quantity }]).success).toBe(false);
		expect(
			DistributionMemberBatchSchema.safeParse(
				Array.from({ length: 129 }, (_, index) => ({
					...row,
					occurrenceId: `01960000-0000-7000-8000-${index.toString().padStart(12, "0")}`,
				})),
			).success,
		).toBe(false);
	});
	it("rejects nesting and organizational groups rather than manufacturing containment", () => {
		for (const kind of ["package", "grouping", "franchise", "work", "release_group", "track"])
			expect(DistributionTargetSchema.safeParse({ ...target, kind }).success).toBe(false);
	});
	it("bounds actual UTF-8 storage and does not accept source or rights fields", () => {
		expect(
			DistributionMemberBatchSchema.safeParse([{ ...row, originalNumber: "漢".repeat(342) }])
				.success,
		).toBe(false);
		expect(
			DistributionMemberBatchSchema.safeParse([{ ...row, license: "inherited" }]).success,
		).toBe(false);
		expect(DistributionRevisionValuesSchema.safeParse({ label: null }).success).toBe(true);
		expect(
			DistributionRevisionValuesSchema.safeParse({ label: "Package", provider: "vndb" }).success,
		).toBe(false);
	});
});
