import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CustomThemeExternalLiveAccessGrantResponse,
	SetCustomThemeExternalLiveAccessBody,
} from "./schema";

describe("Custom Theme external-live access mutation schema", () => {
	it("accepts only the narrow grant and revocation discriminants", () => {
		expect(
			Value.Check(SetCustomThemeExternalLiveAccessBody, {
				expectedRevision: "revision-1",
				state: "granted",
				expiresAt: "2026-09-01T00:00:00.000Z",
			}),
		).toBe(true);
		expect(
			Value.Check(SetCustomThemeExternalLiveAccessBody, {
				expectedRevision: "revision-1",
				state: "revoked",
			}),
		).toBe(true);
		expect(
			Value.Check(SetCustomThemeExternalLiveAccessBody, {
				expectedRevision: "revision-1",
				state: "granted",
				expiresAt: "2026-09-01T00:00:00.000Z",
				capability: "platform.access.manage",
			}),
		).toBe(false);
		expect(
			Value.Check(SetCustomThemeExternalLiveAccessBody, {
				expectedRevision: "revision-1",
				state: "revoked",
				expiresAt: "2026-09-01T00:00:00.000Z",
			}),
		).toBe(false);
	});

	it("distinguishes the permanent Bootstrap grant from expiring grants", () => {
		const common = {
			id: "019b76da-a800-7900-8000-000000000001",
			grantedByProfileId: "019b76da-a800-7200-8000-000000000004",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		};
		expect(
			Value.Check(CustomThemeExternalLiveAccessGrantResponse, {
				...common,
				state: "permanent",
				expiresAt: null,
			}),
		).toBe(true);
		expect(
			Value.Check(CustomThemeExternalLiveAccessGrantResponse, {
				...common,
				state: "granted",
				expiresAt: null,
			}),
		).toBe(false);
		expect(
			Value.Check(CustomThemeExternalLiveAccessGrantResponse, {
				...common,
				state: "permanent",
				expiresAt: "2026-09-01T00:00:00.000Z",
			}),
		).toBe(false);
	});
});
