export const DockKinds = ["main", "wiki"] as const;

export type DockKind = (typeof DockKinds)[number];

export const DockOwnerKinds = ["book", "software", "media", "zone", "realm"] as const;

export type DockOwnerKind = (typeof DockOwnerKinds)[number];

export type DockTarget =
	| { readonly ownerKind: "realm"; readonly dockKind: "main" | "wiki" }
	| {
			readonly ownerKind: Exclude<DockOwnerKind, "realm">;
			readonly dockKind: "main";
	  };

const SupportedKinds = {
	book: ["main"],
	software: ["main"],
	media: ["main"],
	zone: ["main"],
	realm: ["main", "wiki"],
} as const satisfies Record<DockOwnerKind, readonly DockKind[]>;

const UnitPresentationBatchSize = 100;

export function isDockOwnerKind(value: string): value is DockOwnerKind {
	return DockOwnerKinds.some((kind) => kind === value);
}

export function isDockKind(value: string): value is DockKind {
	return DockKinds.some((kind) => kind === value);
}

export function getSupportedDockKinds(ownerKind: string): readonly DockKind[] {
	return isDockOwnerKind(ownerKind) ? SupportedKinds[ownerKind] : [];
}

export function createDockTarget(ownerKind: string, dockKind: DockKind): DockTarget | undefined {
	if (!isDockOwnerKind(ownerKind)) return undefined;
	if (!getSupportedDockKinds(ownerKind).includes(dockKind)) return undefined;
	if (ownerKind === "realm") return { ownerKind, dockKind };
	return dockKind === "main" ? { ownerKind, dockKind } : undefined;
}

export function dockAuthorizationScope(kind: DockKind): readonly ["dock", DockKind] {
	return ["dock", kind];
}

export function partitionDockPresentationIds(
	ids: readonly string[],
): readonly (readonly string[])[] {
	const batches: string[][] = [];
	for (let start = 0; start < ids.length; start += UnitPresentationBatchSize) {
		batches.push(ids.slice(start, start + UnitPresentationBatchSize));
	}
	return batches;
}

export function getDockAddableBlockTypes(target: DockTarget) {
	if (target.ownerKind === "zone")
		return ["realm-ref", "zone-ref", "feed", "menu", "divider"] as const;
	if (target.ownerKind === "realm" && target.dockKind === "wiki")
		return ["realm-ref", "zone-ref", "menu", "divider"] as const;
	return ["realm-ref", "zone-ref", "divider"] as const;
}
