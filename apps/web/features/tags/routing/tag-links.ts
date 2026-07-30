import type { EmbeddableSearchTemplateId } from "@rezics/filter";
import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { searchParamsParsers } from "@/lib/search-params";
import type { UnitTagVoteContextAddress } from "./tag-create-route";

export interface TagSearchTarget {
	readonly tagId: string;
	readonly label: string;
}

const serializeSearch = createSerializer(searchParamsParsers);
const unitTagsRouteParsers = {
	context: parseAsStringLiteral(["global", "realm"] as const),
	createdTagId: parseAsString,
	realmId: parseAsString,
};
const loadUnitTagsRouteSearchParams = createLoader(unitTagsRouteParsers);
const serializeUnitTagsRouteSearchParams = createSerializer(unitTagsRouteParsers);

function tagSearchTemplate(type: UnitDetailUnitType): EmbeddableSearchTemplateId {
	return type === "series" ? "global" : type;
}

export interface UnitTagsRouteState {
	readonly context: UnitTagVoteContextAddress;
	readonly createdTagId?: string;
}

export async function loadUnitTagsRouteState(
	searchParams:
		| Promise<Record<string, string | string[] | undefined>>
		| Record<string, string | string[] | undefined>,
): Promise<UnitTagsRouteState> {
	const parsed = loadUnitTagsRouteSearchParams(await searchParams);
	const createdTagId =
		parsed.createdTagId && isUnitId(parsed.createdTagId) ? parsed.createdTagId : undefined;
	if (parsed.context === "realm" && parsed.realmId && isUnitId(parsed.realmId))
		return {
			context: { kind: "realm", realmId: parsed.realmId },
			...(createdTagId ? { createdTagId } : {}),
		};
	return {
		context: { kind: "global" },
		...(createdTagId ? { createdTagId } : {}),
	};
}

export function unitTagsHref(
	type: UnitDetailUnitType,
	unitId: string,
	state?: UnitTagsRouteState,
): string {
	const pathname = `/units/${type}/${unitId}/tags`;
	if (!state) return pathname;
	return `${pathname}${serializeUnitTagsRouteSearchParams({
		context: state.context.kind,
		createdTagId: state.createdTagId ?? null,
		realmId: state.context.kind === "realm" ? state.context.realmId : null,
	})}`;
}

export function tagSearchHref(type: UnitDetailUnitType, tags: readonly TagSearchTarget[]): string {
	const unique = new Map(tags.map((tag) => [tag.tagId, tag]));
	return `/search${serializeSearch({
		template: tagSearchTemplate(type),
		tag: [...unique.values()].map(({ tagId }) => tagId),
		tagLabel: [...unique.values()].map(({ label }) => label),
	})}`;
}

export function tagDetailHref(tagId: string): string {
	return `/tags/${tagId}`;
}

export function tagStructureHref(structureId: string): string {
	return `/tag-structures/${structureId}`;
}
