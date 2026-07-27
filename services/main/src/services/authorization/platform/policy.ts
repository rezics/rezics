import {
	expandPlatformCapabilities,
	PlatformCapabilityValues,
	type PlatformCapability,
} from "@rezics/access";

export type { PlatformCapability };

export function isPlatformCapability(value: string): value is PlatformCapability {
	return PlatformCapabilityValues.some((capability) => capability === value);
}

export function grantingPlatformCapabilities(requested: PlatformCapability): PlatformCapability[] {
	return PlatformCapabilityValues.filter((candidate) =>
		expandPlatformCapabilities([candidate]).includes(requested),
	);
}

export function preservesPermanentAccessManager(
	currentPermanentManagerProfileIds: readonly string[],
	targetProfileId: string,
	targetWillRemainPermanentManager: boolean,
): boolean {
	return (
		targetWillRemainPermanentManager ||
		currentPermanentManagerProfileIds.some((profileId) => profileId !== targetProfileId)
	);
}
