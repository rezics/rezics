import type {
	PostApiFeedQueryStatus200,
	PostApiFeedQueryStatus200ItemsUnitKindEnum,
} from "@rezics/openapi-tanstack-query";

export type FeedPrimaryAction = "collect" | "follow" | "none";
type FeedPostKind = Extract<
	PostApiFeedQueryStatus200["items"][number],
	{ itemType: "post" }
>["postKind"];

export type FeedActionPolicy = Readonly<{
	comments: boolean;
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
			return { comments: true, primary: "none" };
		case "unit":
			return getUnitActionPolicy(input.unitKind);
	}
}

function getUnitActionPolicy(kind: PostApiFeedQueryStatus200ItemsUnitKindEnum): FeedActionPolicy {
	switch (kind) {
		case "collection":
		case "realm":
		case "zone":
			return { comments: false, primary: "follow" };
		case "poll":
			return { comments: false, primary: "none" };
		case "profile":
		case "book":
		case "software":
		case "media":
		case "release":
		case "entity":
		case "tag":
		case "series":
			return { comments: false, primary: "collect" };
		default:
			return assertNever(kind);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled feed content kind: ${String(value)}`);
}
