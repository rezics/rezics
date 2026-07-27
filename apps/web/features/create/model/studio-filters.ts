import {
	ListCurrentUserStudioContentPermission,
	ListCurrentUserStudioContentSort,
	ListCurrentUserStudioContentStatus,
	ListCurrentUserStudioContentVisibility,
	ListCurrentUserStudioContentView,
	ListCurrentUserStudioContentWorkState,
	type ListCurrentUserStudioContentPermission as StudioPermission,
	type ListCurrentUserStudioContentSort as StudioSort,
	type ListCurrentUserStudioContentStatus as StudioStatus,
	type ListCurrentUserStudioContentVisibility as StudioVisibility,
	type ListCurrentUserStudioContentView as StudioView,
	type ListCurrentUserStudioContentWorkState as StudioWorkState,
} from "@rezics/openapi-tanstack-query";
import { parseAsStringLiteral } from "nuqs/server";

import { urlStateOptions } from "@/lib/search-params";

export const StudioViews = Object.values(ListCurrentUserStudioContentView);
export const StudioPermissions = Object.values(ListCurrentUserStudioContentPermission);
export const StudioWorkStates = Object.values(ListCurrentUserStudioContentWorkState);
export const StudioStatuses = Object.values(ListCurrentUserStudioContentStatus);
export const StudioVisibilities = Object.values(ListCurrentUserStudioContentVisibility);
export const StudioSorts = Object.values(ListCurrentUserStudioContentSort);

export const AnyStudioFilter = "any" as const;
export type OptionalStudioPermission = StudioPermission | typeof AnyStudioFilter;
export type OptionalStudioWorkState = StudioWorkState | typeof AnyStudioFilter;
export type OptionalStudioStatus = StudioStatus | typeof AnyStudioFilter;
export type OptionalStudioVisibility = StudioVisibility | typeof AnyStudioFilter;

const queryStateOptions = { ...urlStateOptions, history: "push" } as const;

export const studioViewParser = parseAsStringLiteral(StudioViews)
	.withDefault("all")
	.withOptions(queryStateOptions);
export const studioPermissionParser = parseAsStringLiteral([AnyStudioFilter, ...StudioPermissions])
	.withDefault(AnyStudioFilter)
	.withOptions(queryStateOptions);
export const studioWorkStateParser = parseAsStringLiteral([AnyStudioFilter, ...StudioWorkStates])
	.withDefault(AnyStudioFilter)
	.withOptions(queryStateOptions);
export const studioStatusParser = parseAsStringLiteral([AnyStudioFilter, ...StudioStatuses])
	.withDefault(AnyStudioFilter)
	.withOptions(queryStateOptions);
export const studioVisibilityParser = parseAsStringLiteral([AnyStudioFilter, ...StudioVisibilities])
	.withDefault(AnyStudioFilter)
	.withOptions(queryStateOptions);
export const studioSortParser = parseAsStringLiteral(StudioSorts)
	.withDefault("recent")
	.withOptions(queryStateOptions);

export type {
	StudioPermission,
	StudioSort,
	StudioStatus,
	StudioView,
	StudioVisibility,
	StudioWorkState,
};
