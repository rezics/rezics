import {
	ListCurrentUserContributionResourcesKind,
	ListCurrentUserStudioContentSource,
	ListCurrentUserStudioContentStatus,
	ListCurrentUserStudioContentVisibility,
	type ListCurrentUserContributionResourcesKind as ContributionKind,
	type ListCurrentUserStudioContentSource as WorkspaceSource,
	type ListCurrentUserStudioContentStatus as StudioStatus,
	type ListCurrentUserStudioContentVisibility as StudioVisibility,
} from "@rezics/openapi-tanstack-query";
import { parseAsStringLiteral } from "nuqs/server";

import { urlStateOptions } from "@/lib/search-params";

export const StudioModes = ["workspace", "contributions"] as const;
export type StudioMode = (typeof StudioModes)[number];

export const WorkspaceSources = Object.values(ListCurrentUserStudioContentSource);
export const ContributionKinds = Object.values(ListCurrentUserContributionResourcesKind);
export const StudioStatuses = Object.values(ListCurrentUserStudioContentStatus);
export const StudioVisibilities = Object.values(ListCurrentUserStudioContentVisibility);

export const AnyStudioFilter = "any" as const;
export type OptionalStudioStatus = StudioStatus | typeof AnyStudioFilter;
export type OptionalStudioVisibility = StudioVisibility | typeof AnyStudioFilter;

const queryStateOptions = { ...urlStateOptions, history: "push" } as const;

export const studioModeParser = parseAsStringLiteral(StudioModes)
	.withDefault("workspace")
	.withOptions(queryStateOptions);
export const workspaceSourceParser = parseAsStringLiteral(WorkspaceSources)
	.withDefault("all")
	.withOptions(queryStateOptions);
export const contributionKindParser = parseAsStringLiteral(ContributionKinds)
	.withDefault("all")
	.withOptions(queryStateOptions);
export const studioStatusParser = parseAsStringLiteral([AnyStudioFilter, ...StudioStatuses])
	.withDefault(AnyStudioFilter)
	.withOptions(queryStateOptions);
export const studioVisibilityParser = parseAsStringLiteral([AnyStudioFilter, ...StudioVisibilities])
	.withDefault(AnyStudioFilter)
	.withOptions(queryStateOptions);

export const studioFilterParsers = {
	mode: studioModeParser,
	source: workspaceSourceParser,
	kind: contributionKindParser,
	status: studioStatusParser,
	visibility: studioVisibilityParser,
} as const;

export type { ContributionKind, StudioStatus, StudioVisibility, WorkspaceSource };
