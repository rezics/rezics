import { PlatformCapabilityValues, type PlatformCapability } from "@rezics/access";

export type { PlatformCapability };

export function isPlatformCapability(value: string): value is PlatformCapability {
	return PlatformCapabilityValues.some((capability) => capability === value);
}

export function isSuperAdminCapabilitySet(capabilities: ReadonlySet<PlatformCapability>): boolean {
	return PlatformCapabilityValues.every((capability) => capabilities.has(capability));
}

export function preservesPermanentGrantManager(
	currentPermanentManagerProfileIds: readonly string[],
	targetProfileId: string,
	targetWillRemainPermanentManager: boolean,
): boolean {
	return (
		targetWillRemainPermanentManager ||
		currentPermanentManagerProfileIds.some((profileId) => profileId !== targetProfileId)
	);
}
