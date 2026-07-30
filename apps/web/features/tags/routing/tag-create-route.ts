import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server";

import {
	publicEntrySearchConfirmation,
	TagPublicEntrySearchSubject,
} from "@/features/catalog/model/public-entry-search";
import { StudioTagCreateHref } from "@/features/create/model/studio-section";
import {
	CatalogDetailUnitTypes,
	type CatalogDetailUnitType,
} from "@/features/units/model/catalog-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";

const TagCreateIntentValues = ["unit-tag-vote"] as const;
const TagVoteContextValues = ["global", "realm"] as const;

const tagCreateRouteParsers = {
	context: parseAsStringLiteral(TagVoteContextValues),
	intent: parseAsStringLiteral(TagCreateIntentValues),
	publicEntrySearch: parseAsString,
	realmId: parseAsString,
	title: parseAsString.withDefault(""),
	unitId: parseAsString,
	unitType: parseAsStringLiteral(CatalogDetailUnitTypes),
};

const loadTagCreateRouteSearchParams = createLoader(tagCreateRouteParsers);
const serializeTagCreateRouteSearchParams = createSerializer(tagCreateRouteParsers);

export type UnitTagVoteContextAddress =
	{ readonly kind: "global" } | { readonly kind: "realm"; readonly realmId: string };

export interface UnitTagVoteCreateTarget {
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
	readonly context: UnitTagVoteContextAddress;
}

export type TagCreateIntent =
	| { readonly kind: "standalone" }
	| ({ readonly kind: "unit-tag-vote" } & UnitTagVoteCreateTarget);

export type TagCreateRoute =
	| {
			readonly status: "ready";
			readonly initialTitle: string;
			readonly publicEntrySearchConfirmation: string | null;
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
		publicEntrySearchConfirmation: parsed.publicEntrySearch,
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

export function unitTagVoteCreateHref(query: string, target: UnitTagVoteCreateTarget): string {
	const title = query.trim();
	return `${StudioTagCreateHref}${serializeTagCreateRouteSearchParams({
		context: target.context.kind,
		intent: "unit-tag-vote",
		publicEntrySearch: publicEntrySearchConfirmation(TagPublicEntrySearchSubject, title),
		realmId: target.context.kind === "realm" ? target.context.realmId : null,
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
