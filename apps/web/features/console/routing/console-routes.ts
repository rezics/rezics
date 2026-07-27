import { isConsoleSectionId, type ConsoleSectionId } from "../model/console-section";

export const ConsoleOverviewHref = "/console";

export function consoleSectionHref(section: ConsoleSectionId): string {
	return `${ConsoleOverviewHref}/${section}`;
}

export function parseConsoleSection(pathname: string): ConsoleSectionId | undefined {
	const match = /^\/console\/([^/]+)\/?$/.exec(pathname);
	return match?.[1] && isConsoleSectionId(match[1]) ? match[1] : undefined;
}
