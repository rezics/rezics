import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateAssociationInvitationBody, CreateAssociationRequestBody } from "./schema";

const id = "0195c49b-8f3b-7e18-8c45-c2f36ee8d337";

describe("Unit association proposal API contracts", () => {
	it("keeps source requests and target invitations direction-specific", () => {
		expect(
			Check(CreateAssociationRequestBody, {
				targetUnitId: id,
				kind: "credit",
				role: "author",
				expiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(true);
		expect(
			Check(CreateAssociationInvitationBody, {
				sourceUnitId: id,
				kind: "subject",
				role: "primary_character",
				expiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(true);
		expect(
			Check(CreateAssociationRequestBody, {
				sourceUnitId: id,
				kind: "credit",
				role: "author",
				expiresAt: "2026-08-01T00:00:00.000Z",
			}),
		).toBe(false);
	});
});
