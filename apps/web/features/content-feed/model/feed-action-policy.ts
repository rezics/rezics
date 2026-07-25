import type {
	GetApiFeedStatus200,
	GetApiFeedStatus200ItemsUnitKindEnum,
} from "@rezics/openapi-tanstack-query";

export type FeedPrimaryAction = "collect" | "follow" | "none";
type FeedPostKind = Extract<GetApiFeedStatus200["items"][number], { itemType: "post" }>["postKind"];

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
			unitKind: GetApiFeedStatus200ItemsUnitKindEnum;
	  }>;

export function getFeedActionPolicy(input: FeedActionPolicyInput): FeedActionPolicy {
	switch (input.itemType) {
		case "post":
			return { comments: true, primary: "none" };
		case "unit":
			return getUnitActionPolicy(input.unitKind);
	}
}

function getUnitActionPolicy(kind: GetApiFeedStatus200ItemsUnitKindEnum): FeedActionPolicy {
	switch (kind) {
		case "collection":
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
		case "zone":
		case "realm":
			return { comments: false, primary: "collect" };
		default:
			return assertNever(kind);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled feed content kind: ${String(value)}`);
}
