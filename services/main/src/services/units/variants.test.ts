import { describe, expect, it } from "vitest";

import { isDiscoverableVariantUnit } from "./variant-policy";
import { isVariantCapableUnitKind, toUnitVariantConstraintError } from "./variants";

describe("Main-Variant rules", () => {
	it.each(["book", "software", "media", "entity"])("accepts the %s Unit kind", (kind) => {
		expect(isVariantCapableUnitKind(kind)).toBe(true);
	});

	it.each(["series", "profile", "post"])("rejects the %s Unit kind", (kind) => {
		expect(isVariantCapableUnitKind(kind)).toBe(false);
	});

	it("defines public discovery availability as one complete lifecycle state", () => {
		const discoverable = {
			status: "published",
			visibility: "public",
			moderationStatus: "approved",
			deletedAt: null,
		};
		expect(isDiscoverableVariantUnit(discoverable)).toBe(true);
		for (const state of [
			{ ...discoverable, status: "draft" },
			{ ...discoverable, visibility: "unlisted" },
			{ ...discoverable, moderationStatus: "pending" },
			{ ...discoverable, deletedAt: new Date() },
		])
			expect(isDiscoverableVariantUnit(state)).toBe(false);
	});

	it("maps database race failures back to stable semantic errors", () => {
		expect(
			toUnitVariantConstraintError({
				cause: { constraint: "unit_variant_target_is_variant" },
			}),
		).toMatchObject({ type: "UnitVariantTargetIsVariant", status: 409 });
		expect(
			toUnitVariantConstraintError({ constraint: "unit_variant_main_kind_fkey" }),
		).toMatchObject({ type: "UnitVariantKindMismatch", status: 409 });
		expect(
			toUnitVariantConstraintError({
				constraint: "unit_variant_entity_kind_mismatch",
			}),
		).toMatchObject({ type: "UnitVariantKindMismatch", status: 409 });
		expect(
			toUnitVariantConstraintError({ constraint: "entity_variant_kind_change" }),
		).toMatchObject({ type: "UnitVariantKindMismatch", status: 409 });
		expect(toUnitVariantConstraintError({ constraint: "entity_variant_delete" })).toMatchObject({
			type: "UnitVariantKindMismatch",
			status: 409,
		});
		expect(toUnitVariantConstraintError(new Error("unrelated"))).toBeUndefined();
	});
});
