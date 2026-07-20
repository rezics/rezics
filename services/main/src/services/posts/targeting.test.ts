import { describe, expect, it } from "vitest";

import { PostTargetingLocked } from "./errors";
import { toPostTargetingConstraintError } from "./targeting";

describe("Post Targeting Lock database error mapping", () => {
	it("maps a nested global-lock constraint violation", () => {
		const mapped = toPostTargetingConstraintError({
			cause: {
				constraint: "post_targeting_global_unlocked",
				detail: JSON.stringify({
					scope: "global",
					relation: "subject",
					targetUnitId: "00000000-0000-0000-0000-000000000001",
				}),
			},
		});

		expect(mapped).toBeInstanceOf(PostTargetingLocked);
		expect(mapped?.details).toEqual({
			scope: "global",
			relation: "subject",
			targetUnitId: "00000000-0000-0000-0000-000000000001",
		});
	});

	it("maps a Realm-lock constraint violation", () => {
		const mapped = toPostTargetingConstraintError({
			constraint: "post_targeting_realm_unlocked",
			detail: JSON.stringify({
				scope: "realm",
				relation: "parent",
				targetUnitId: "00000000-0000-0000-0000-000000000002",
				realmId: "00000000-0000-0000-0000-000000000003",
			}),
		});

		expect(mapped?.details).toEqual({
			scope: "realm",
			relation: "parent",
			targetUnitId: "00000000-0000-0000-0000-000000000002",
			realmId: "00000000-0000-0000-0000-000000000003",
		});
	});

	it("does not convert unrelated or malformed database errors", () => {
		expect(
			toPostTargetingConstraintError({
				constraint: "some_other_constraint",
				detail: "{}",
			}),
		).toBeUndefined();
		expect(
			toPostTargetingConstraintError({
				constraint: "post_targeting_realm_unlocked",
				detail: JSON.stringify({
					scope: "realm",
					relation: "root",
					targetUnitId: "00000000-0000-0000-0000-000000000002",
				}),
			}),
		).toBeUndefined();
	});
});
