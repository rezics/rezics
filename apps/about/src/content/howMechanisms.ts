import type { ProductId } from "./productRegistry";

export const HOW_SCOPE_IDS = ["shared", "realm", "personal"] as const;

export type HowScopeId = (typeof HOW_SCOPE_IDS)[number];

export const HOW_MECHANISM_DEFINITIONS = [
	{ id: "identity", productId: "unit" },
	{ id: "language", productId: "collection" },
	{ id: "realm", productId: "realm" },
	{ id: "tag-vote", productId: "tag" },
	{ id: "content", productId: "content-structure" },
] as const satisfies readonly {
	readonly id: string;
	readonly productId: ProductId;
}[];

export type HowMechanismId = (typeof HOW_MECHANISM_DEFINITIONS)[number]["id"];
