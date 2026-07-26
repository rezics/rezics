import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ListRealmMembersQuery, ListRealmUnitsQuery, ModerateRealmUnitBody } from "./schema";

describe("Realm member API contract", () => {
	it("accepts an exact Profile identity filter", () => {
		expect(
			Check(ListRealmMembersQuery, {
				profileId: "019f995d-7595-7c99-9183-250790bbfe2f",
				limit: 1,
			}),
		).toBe(true);
		expect(Check(ListRealmMembersQuery, { profileId: "not-a-profile-id" })).toBe(false);
	});
});

describe("Realm moderation API contract", () => {
	it("treats an omitted status filter as all Realm Unit states", () => {
		expect(ListRealmUnitsQuery.properties.status.default).toBeUndefined();
		expect(Check(ListRealmUnitsQuery, {})).toBe(true);
	});

	it("accepts commands and rejects client-authored resulting state", () => {
		expect(
			Check(ModerateRealmUnitBody, {
				command: "hide",
				reasonCode: "realm_rules",
				idempotencyKey: "moderate-0195c49b",
			}),
		).toBe(true);
		expect(
			Check(ModerateRealmUnitBody, {
				status: "hidden",
				reasonCode: "realm_rules",
			}),
		).toBe(false);
	});

	it("requires a Post-backed annotation for note commands", () => {
		expect(
			Check(ModerateRealmUnitBody, {
				command: "note",
				reasonCode: "administrative",
			}),
		).toBe(false);
		expect(
			Check(ModerateRealmUnitBody, {
				command: "note",
				reasonCode: "administrative",
				annotation: {
					role: "internal_note",
					language: "zh",
					content: createPortableTextDocument([], "0123456789ab"),
				},
			}),
		).toBe(true);
	});
});
