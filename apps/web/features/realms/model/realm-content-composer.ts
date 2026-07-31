export const RealmContentComposerBaseModes = ["post", "wiki"] as const;
export const RealmContentComposerDefaultMode = "post" as const;

export type RealmContentComposerMode =
	(typeof RealmContentComposerBaseModes)[number] | "tag-context";

export function isRealmContentComposerMode(value: string): value is RealmContentComposerMode {
	return value === "post" || value === "wiki" || value === "tag-context";
}

export function getRealmContentComposerModes(input: {
	readonly tagVotingEnabled: boolean;
	readonly canManageTagContexts: boolean;
}): readonly RealmContentComposerMode[] {
	return input.tagVotingEnabled && input.canManageTagContexts
		? [...RealmContentComposerBaseModes, "tag-context"]
		: RealmContentComposerBaseModes;
}
