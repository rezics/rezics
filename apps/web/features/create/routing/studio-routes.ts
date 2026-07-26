import { isStudioSectionId, type StudioSectionId } from "../model/studio-section";

export const StudioOverviewHref = "/create";

export function studioSectionHref(sectionId: StudioSectionId): string {
	return `${StudioOverviewHref}/${sectionId}`;
}

export function parseStudioSection(pathname: string): StudioSectionId | undefined {
	const match = /^\/create\/([^/]+)\/?$/.exec(pathname);
	const value = match?.[1];
	return value && isStudioSectionId(value) ? value : undefined;
}
