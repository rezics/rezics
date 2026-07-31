export const RealmTagContextComposerIntents = ["create", "bind-existing"] as const;
const RealmTagContextComposerIntentSet = new Set<string>(RealmTagContextComposerIntents);

export type RealmTagContextComposerIntent = (typeof RealmTagContextComposerIntents)[number];

export function isRealmTagContextComposerIntent(
	value: string,
): value is RealmTagContextComposerIntent {
	return RealmTagContextComposerIntentSet.has(value);
}

export function getRealmTagContextComposerIntents(
	canCreateWiki: boolean,
): readonly RealmTagContextComposerIntent[] {
	return canCreateWiki ? RealmTagContextComposerIntents : ["bind-existing"];
}
