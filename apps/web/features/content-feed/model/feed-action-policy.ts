import type {
	PostApiFeedQueryStatus200,
	PostApiFeedQueryStatus200ItemsUnitKindEnum,
} from "@rezics/openapi-tanstack-query";

export type FeedPrimaryAction = "collect" | "follow" | "none";
export type FeedDiscussionAction = "discussions" | "none" | "replies";
type FeedPostKind = Extract<
	PostApiFeedQueryStatus200["items"][number],
	{ itemType: "post" }
>["postKind"];

export type FeedActionPolicy = Readonly<{
	discussion: FeedDiscussionAction;
	primary: FeedPrimaryAction;
}>;

export type FeedActionPolicyInput =
	| Readonly<{
			itemType: "post";
			postKind: FeedPostKind;
	  }>
	| Readonly<{
			itemType: "unit";
			unitKind: PostApiFeedQueryStatus200ItemsUnitKindEnum;
	  }>;

export function getFeedActionPolicy(input: FeedActionPolicyInput): FeedActionPolicy {
	switch (input.itemType) {
		case "post":
			return { discussion: "replies", primary: "none" };
		case "unit":
			return getUnitActionPolicy(input.unitKind);
	}
}

function getUnitActionPolicy(kind: PostApiFeedQueryStatus200ItemsUnitKindEnum): FeedActionPolicy {
	switch (kind) {
		case "collection":
		case "realm":
		case "zone":
			return { discussion: "none", primary: "follow" };
		case "poll":
			return { discussion: "none", primary: "none" };
		case "book":
		case "software":
		case "media":
		case "tag":
		case "series":
			return { discussion: "discussions", primary: "collect" };
		case "profile":
		case "release":
		case "entity":
		case "structure":
			return { discussion: "none", primary: "collect" };
		default:
			return assertNever(kind);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled feed content kind: ${String(value)}`);
}
