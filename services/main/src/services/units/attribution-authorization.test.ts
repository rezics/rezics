import { describe, expect, it } from "vitest";

import { CreditAttributionRequestConfirmationRequired } from "../entities/errors";
import { ensureCreditAttributionRequestsConfirmed } from "./attribution-authorization";

const directAttribution = {
	entityId: "019b0000-0000-7000-8000-000000000001",
	creationMode: "direct",
} as const;
const requestedAttribution = {
	entityId: "019b0000-0000-7000-8000-000000000002",
	creationMode: "request",
} as const;

describe("credit attribution request confirmation", () => {
	it("allows a direct-only plan without further consent", () => {
		expect(() =>
			ensureCreditAttributionRequestsConfirmed("direct_only", [directAttribution]),
		).not.toThrow();
	});

	it("requires confirmation before a plan can send requests", () => {
		expect(() =>
			ensureCreditAttributionRequestsConfirmed("direct_only", [
				directAttribution,
				requestedAttribution,
				requestedAttribution,
			]),
		).toThrowError(
			expect.objectContaining<Partial<CreditAttributionRequestConfirmationRequired>>({
				_tag: "CreditAttributionRequestConfirmationRequired",
				details: { entityIds: [requestedAttribution.entityId] },
			}),
		);
	});

	it("allows a request plan after explicit confirmation", () => {
		expect(() =>
			ensureCreditAttributionRequestsConfirmed("allow_requests", [requestedAttribution]),
		).not.toThrow();
	});
});
