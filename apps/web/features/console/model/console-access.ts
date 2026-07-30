import type { GetApiUsersMeStatus200PlatformCapabilitiesEnum as PlatformCapability } from "@rezics/openapi-tanstack-query";

import { ConsoleSectionIds, type ConsoleSectionId } from "./console-section";

export const ConsoleSectionRequiredCapability = {
	users: "platform.user.read",
	units: "unit.governance.read",
	"ownership-claims": "unit.governance.read",
	moderation: "platform.moderate",
	audit: "platform.audit.read",
	"token-policies": "platform.api_token_policy.manage",
} as const satisfies Record<ConsoleSectionId, PlatformCapability>;

export function getAccessibleConsoleSectionIds(
	platformCapabilities: readonly string[],
): readonly ConsoleSectionId[] {
	const capabilities = new Set(platformCapabilities);
	return ConsoleSectionIds.filter((sectionId) =>
		capabilities.has(ConsoleSectionRequiredCapability[sectionId]),
	);
}

export function hasConsoleAccess(platformCapabilities: readonly string[]): boolean {
	return getAccessibleConsoleSectionIds(platformCapabilities).length > 0;
}

export function canAccessConsoleSection(
	platformCapabilities: readonly string[],
	sectionId: ConsoleSectionId,
): boolean {
	return platformCapabilities.includes(ConsoleSectionRequiredCapability[sectionId]);
}
