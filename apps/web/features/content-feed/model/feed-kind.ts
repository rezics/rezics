import {
	GetApiFeedContentEnum,
	type GetApiFeedContentEnum as ApiFeedContentKind,
} from "@rezics/openapi-tanstack-query";
import { parseAsArrayOf, parseAsStringLiteral } from "nuqs/server";

import { urlStateOptions } from "@/lib/search-params";

export const FeedContentKinds = Object.values(GetApiFeedContentEnum);
export type FeedContentKind = ApiFeedContentKind;

export const DefaultFeedContentKinds = FeedContentKinds.filter(
	(kind) => kind !== GetApiFeedContentEnum["post:reply"],
);

export const feedContentParser = parseAsArrayOf(parseAsStringLiteral(FeedContentKinds))
	.withDefault([...DefaultFeedContentKinds])
	.withOptions({ ...urlStateOptions, history: "push" });

export const PostListContentKinds = [
	GetApiFeedContentEnum["post:post"],
	GetApiFeedContentEnum["post:reply"],
] as const;
export type PostListContentKind = (typeof PostListContentKinds)[number];

export const DefaultPostListContentKinds = [GetApiFeedContentEnum["post:post"]] as const;

export function isPostListContentKind(kind: FeedContentKind): kind is PostListContentKind {
	return PostListContentKinds.some((candidate) => candidate === kind);
}

export function feedContentKindGroup(kind: FeedContentKind): "unit" | "post" {
	return kind.startsWith("unit:") ? "unit" : "post";
}
