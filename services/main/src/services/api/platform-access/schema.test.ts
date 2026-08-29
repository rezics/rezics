import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { SetCustomThemeExternalLiveAccessBody } from "./schema";

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
});
