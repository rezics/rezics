import { createLoader, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { isUnitId } from "@/features/units/model/unit-id";
import { searchParamsParsers } from "@/lib/search-params";
import type { UnitTagVoteContextAddress } from "./tag-create-route";
import {
	isTagDetailSection,
	TagDetailSections,
	type TagDetailSectionId,
} from "../model/tag-detail-section";
import {
	isTagManagementSection,
	type TagManagementSectionId,
} from "../model/tag-management-section";

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

export function tagSearchHref(_type: UnitDetailUnitType, tags: readonly TagSearchTarget[]): string {
	const unique = new Map(tags.map((tag) => [tag.tagId, tag]));
	return `/search${serializeSearch({
		tag: [...unique.values()].map(({ tagId }) => tagId),
		tagLabel: [...unique.values()].map(({ label }) => label),
	})}`;
}

export function tagDetailHref(tagId: string, sectionId: TagDetailSectionId = "overview"): string {
	const base = `/tags/${tagId}`;
	return sectionId === "overview" ? base : `${base}/${sectionId}`;
}

export function parseTagDetailSection(
	pathname: string,
	tagId: string,
): TagDetailSectionId | undefined {
	const base = tagDetailHref(tagId);
	if (pathname === base || pathname === `${base}/`) return "overview";
	if (!pathname.startsWith(`${base}/`)) return undefined;
	const suffix = pathname.slice(base.length + 1);
	return !suffix.includes("/") && isTagDetailSection(suffix) ? suffix : undefined;
}

export function getTagDetailHrefs(tagId: string): readonly {
	readonly id: TagDetailSectionId;
	readonly href: string;
}[] {
	return TagDetailSections.map((id) => ({ id, href: tagDetailHref(tagId, id) }));
}

export function tagManagementHref(tagId: string, sectionId?: TagManagementSectionId): string {
	const base = `/tags/${tagId}/edit`;
	return sectionId ? `${base}/${sectionId}` : base;
}

export function parseTagManagementSection(
	pathname: string,
	tagId: string,
): TagManagementSectionId | undefined {
	const base = tagManagementHref(tagId);
	if (!pathname.startsWith(`${base}/`)) return undefined;
	const suffix = pathname.slice(base.length + 1);
	return !suffix.includes("/") && isTagManagementSection(suffix) ? suffix : undefined;
}

export function tagStructureHref(structureId: string): string {
	return `/tag-structures/${structureId}`;
}
