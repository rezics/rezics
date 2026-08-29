import { describe, expect, it } from "vitest";

import { BootstrapPlatformAdministratorProfile } from "../bootstrap/data/foundation";
import {
	classifyCustomThemeExternalLiveAccessGrant,
	customThemePlatformAccessCapacityReason,
	isCustomThemeExternalLiveExpiryValid,
	isPermanentBootstrapCustomThemeExternalLiveAccessGrant,
	MaximumActiveCustomThemeExternalLiveAccessGrants,
	MaximumActiveCustomThemeExternalLiveAccessManagers,
	MaximumCustomThemeExternalLiveAccessGrantDays,
} from "./service";

describe("Custom Theme external-live access policy", () => {
	it("requires a future expiry no more than 90 days from the mutation", () => {
		const now = new Date("2026-08-29T00:00:00.000Z");
		const maximum = new Date(
			now.getTime() + MaximumCustomThemeExternalLiveAccessGrantDays * 24 * 60 * 60 * 1_000,
		);
		expect(isCustomThemeExternalLiveExpiryValid(maximum, now)).toBe(true);
		expect(isCustomThemeExternalLiveExpiryValid(new Date(now.getTime() + 1), now)).toBe(true);
		expect(isCustomThemeExternalLiveExpiryValid(null, now)).toBe(false);
		expect(isCustomThemeExternalLiveExpiryValid(now, now)).toBe(false);
		expect(isCustomThemeExternalLiveExpiryValid(new Date(maximum.getTime() + 1), now)).toBe(false);
	});

	it("models only the self-issued Bootstrap administrator grant as permanent", () => {
		const profileId = BootstrapPlatformAdministratorProfile.profileId;
		expect(
			isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
				profileId,
				grantedByProfileId: profileId,
				expiresAt: null,
			}),
		).toBe(true);
		expect(
			isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
				profileId: "019b76da-a800-7200-8000-000000000003",
				grantedByProfileId: profileId,
				expiresAt: null,
			}),
		).toBe(false);
		expect(
			isPermanentBootstrapCustomThemeExternalLiveAccessGrant({
				profileId,
				grantedByProfileId: "019b76da-a800-7200-8000-000000000003",
				expiresAt: null,
			}),
		).toBe(false);
	});

	it("classifies the Bootstrap exception without accepting ordinary permanent grants", () => {
		const now = new Date("2026-08-29T00:00:00.000Z");
		const common = {
			id: "019b76da-a800-7900-8000-000000000001",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		};
		const profileId = BootstrapPlatformAdministratorProfile.profileId;
		expect(
			classifyCustomThemeExternalLiveAccessGrant(
				{ ...common, profileId, grantedByProfileId: profileId, expiresAt: null },
				now,
			),
		).toMatchObject({ state: "permanent", expiresAt: null });
		expect(() =>
			classifyCustomThemeExternalLiveAccessGrant(
				{
					...common,
					profileId: "019b76da-a800-7200-8000-000000000003",
					grantedByProfileId: profileId,
					expiresAt: null,
				},
				now,
			),
		).toThrow("Only the Bootstrap platform administrator");
	});

	it("enforces the governed access and access-manager population bounds", () => {
		expect(
			customThemePlatformAccessCapacityReason({
				activeAccessGrantCount: MaximumActiveCustomThemeExternalLiveAccessGrants - 1,
				activeAccessManagerCount: MaximumActiveCustomThemeExternalLiveAccessManagers - 1,
				addingAccessGrant: true,
				addingAccessManager: true,
			}),
		).toBeNull();
		expect(
			customThemePlatformAccessCapacityReason({
				activeAccessGrantCount: MaximumActiveCustomThemeExternalLiveAccessGrants,
				activeAccessManagerCount: 0,
				addingAccessGrant: true,
				addingAccessManager: false,
			}),
		).toBe("external_live_access_grant_bound");
		expect(
			customThemePlatformAccessCapacityReason({
				activeAccessGrantCount: 0,
				activeAccessManagerCount: MaximumActiveCustomThemeExternalLiveAccessManagers,
				addingAccessGrant: false,
				addingAccessManager: true,
			}),
		).toBe("external_live_access_manager_bound");
	});
});
