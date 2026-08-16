import { isConsoleSectionId, type ConsoleSectionId } from "../model/console-section";

export const ConsoleOverviewHref = "/console";

export function consoleSectionHref(section: ConsoleSectionId): string {
	return `${ConsoleOverviewHref}/${section}`;
}

export function consoleUnitHref(unitId: string): string {
	return `${consoleSectionHref("units")}/${encodeURIComponent(unitId)}`;
}

export function parseConsoleSection(pathname: string): ConsoleSectionId | undefined {
	const match = /^\/console\/([^/]+)(?:\/.*)?$/.exec(pathname);
	return match?.[1] && isConsoleSectionId(match[1]) ? match[1] : undefined;
}
