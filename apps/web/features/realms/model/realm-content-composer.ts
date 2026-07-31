export const RealmContentComposerBaseModes = ["post", "wiki"] as const;
export const RealmContentComposerDefaultMode = "post" as const;
export const RealmContentComposerModes = [...RealmContentComposerBaseModes, "tag-context"] as const;
const RealmContentComposerModeSet = new Set<string>(RealmContentComposerModes);

export type RealmContentComposerMode = (typeof RealmContentComposerModes)[number];

export function isRealmContentComposerMode(value: string): value is RealmContentComposerMode {
	return RealmContentComposerModeSet.has(value);
}

export function getRealmContentComposerModes(input: {
	readonly tagVotingEnabled: boolean;
	readonly canCreateUnits: boolean;
	readonly canManageTagContexts: boolean;
}): readonly RealmContentComposerMode[] {
	const baseModes = input.canCreateUnits ? RealmContentComposerBaseModes : [];
	return isRealmTagContextComposerAvailable(input) ? [...baseModes, "tag-context"] : baseModes;
}

export function isRealmTagContextComposerAvailable(input: {
	readonly tagVotingEnabled: boolean;
	readonly canManageTagContexts: boolean;
}): boolean {
	return input.tagVotingEnabled && input.canManageTagContexts;
}

export function canCreateRealmTagContext(input: {
	readonly tagVotingEnabled: boolean;
	readonly canCreateUnits: boolean;
	readonly canManageTagContexts: boolean;
}): boolean {
	return input.canCreateUnits && isRealmTagContextComposerAvailable(input);
}
