import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { StudioTagCreateHref } from "@/features/create/model/studio-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { TaggableUnitTypes, type TaggableUnitType } from "../model/taggable-unit";

const TagCreateIntentValues = ["unit-tag-vote"] as const;
const TagVoteContextValues = ["global", "realm"] as const;

const tagCreateRouteParsers = {
	context: parseAsStringLiteral(TagVoteContextValues),
	intent: parseAsStringLiteral(TagCreateIntentValues),
	realmId: parseAsString,
	title: parseAsString.withDefault(""),
	unitId: parseAsString,
	unitType: parseAsStringLiteral(TaggableUnitTypes),
};

const loadTagCreateRouteSearchParams = createLoader(tagCreateRouteParsers);
const serializeTagCreateRouteSearchParams = createSerializer(tagCreateRouteParsers);

export type UnitTagVoteContextAddress =
	| { readonly kind: "global" }
	| { readonly kind: "realm"; readonly realmId: string };

export interface UnitTagVoteCreateTarget {
	readonly type: TaggableUnitType;
	readonly unitId: string;
	readonly context: UnitTagVoteContextAddress;
}

export type GlobalUnitTagVoteCreateTarget = Omit<UnitTagVoteCreateTarget, "context"> & {
	readonly context: { readonly kind: "global" };
};

export type TagRouteIntent =
	| { readonly kind: "standalone" }
	| ({ readonly kind: "unit-tag-vote" } & UnitTagVoteCreateTarget);

export type TagCreateIntent =
	| { readonly kind: "standalone" }
	| ({ readonly kind: "unit-tag-vote" } & GlobalUnitTagVoteCreateTarget);

export type TagCreateRoute =
	| {
			readonly status: "ready";
			readonly initialTitle: string;
			readonly intent: TagRouteIntent;
	  }
	| { readonly status: "invalid" };

export type TagCreationRoute =
	| {
			readonly status: "ready";
			readonly initialTitle: string;
			readonly intent: TagCreateIntent;
	  }
	| { readonly status: "invalid" };

type SearchParams = Record<string, string | string[] | undefined>;

export async function loadTagCreateRoute(
	searchParams: Promise<SearchParams> | SearchParams,
): Promise<TagCreateRoute> {
	const parsed = loadTagCreateRouteSearchParams(await searchParams);
	const common = {
		initialTitle: parsed.title,
	} as const;
	if (!parsed.intent) return { status: "ready", intent: { kind: "standalone" }, ...common };
	if (!parsed.unitType || !parsed.unitId || !isUnitId(parsed.unitId) || !parsed.context)
		return { status: "invalid" };
	if (parsed.context === "realm") {
		if (!parsed.realmId || !isUnitId(parsed.realmId)) return { status: "invalid" };
		return {
			status: "ready",
			intent: {
				kind: "unit-tag-vote",
				type: parsed.unitType,
				unitId: parsed.unitId,
				context: { kind: "realm", realmId: parsed.realmId },
			},
			...common,
		};
	}
	return {
		status: "ready",
		intent: {
			kind: "unit-tag-vote",
			type: parsed.unitType,
			unitId: parsed.unitId,
			context: { kind: "global" },
		},
		...common,
	};
}

export async function loadTagCreationRoute(
	searchParams: Promise<SearchParams> | SearchParams,
): Promise<TagCreationRoute> {
	const route = await loadTagCreateRoute(searchParams);
	if (
		route.status === "invalid" ||
		(route.intent.kind === "unit-tag-vote" && route.intent.context.kind === "realm")
	)
		return { status: "invalid" };
	if (route.intent.kind === "standalone")
		return {
			status: "ready",
			initialTitle: route.initialTitle,
			intent: { kind: "standalone" },
		};
	return {
		...route,
		intent: {
			...route.intent,
			context: { kind: "global" },
		},
	};
}

export function unitTagVoteCreateHref(
	query: string,
	target: GlobalUnitTagVoteCreateTarget,
): string {
	const title = query.trim();
	return `${StudioTagCreateHref}${serializeTagCreateRouteSearchParams({
		context: "global",
		intent: "unit-tag-vote",
		realmId: null,
		title,
		unitId: target.unitId,
		unitType: target.type,
	})}`;
}

export function unitTagVoteDuplicateSearchHref(
	query: string,
	target: UnitTagVoteCreateTarget,
): string {
	const search = new URLSearchParams({
		context: target.context.kind,
		intent: "unit-tag-vote",
		kind: "tag",
		q: query.trim(),
		unitId: target.unitId,
		unitType: target.type,
	});
	if (target.context.kind === "realm") search.set("realmId", target.context.realmId);
	return `/create/tag/search?${search}`;
}
