import type {
	RealmTagGroupPresentation,
	RealmTagVoteContextPresentation,
	TagVoteContextSelection,
} from "./tag-presentation";

export type TagVoteContextRequest =
	{ readonly kind: "global" } | { readonly kind: "realm"; readonly realmId: string };

export const GlobalTagVoteContext = {
	kind: "global",
} as const satisfies TagVoteContextSelection;

export function resolveTagVoteContext(
	requested: TagVoteContextRequest,
	realms: readonly RealmTagVoteContextPresentation[],
): TagVoteContextSelection {
	if (requested.kind === "global") return GlobalTagVoteContext;
	const realm = realms.find(({ realmId }) => realmId === requested.realmId);
	return realm ? { kind: "realm", realm } : GlobalTagVoteContext;
}

export function visibleTagDetailContexts(
	active: TagVoteContextSelection,
	realmGroups: readonly RealmTagGroupPresentation[],
): {
	readonly showGlobal: boolean;
	readonly realmGroups: readonly RealmTagGroupPresentation[];
} {
	if (active.kind === "global") return { showGlobal: false, realmGroups };
	return {
		showGlobal: true,
		realmGroups: realmGroups.filter(({ realmId }) => realmId !== active.realm.realmId),
	};
}
