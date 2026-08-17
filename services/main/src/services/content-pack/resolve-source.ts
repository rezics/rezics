import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ContentPackSourceNotFound } from "./errors";

export const ShowcasePacksDirectoryEnvironmentVariable = "REZICS_SHOWCASE_PACKS_DIR";
export const DefaultShowcasePacksSiblingName = "rezics-showcase-packs";

export function rezicsRepositoryRoot(): string {
	return resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
}

export function defaultSiblingShowcasePacksDir(repositoryRoot = rezicsRepositoryRoot()): string {
	return resolve(repositoryRoot, "..", DefaultShowcasePacksSiblingName);
}

export function isShowcasePacksRoot(directory: string): boolean {
	return existsSync(resolve(directory, "packs"));
}

export function resolveShowcasePacksDir(input: {
	readonly from?: string;
	readonly environment?: NodeJS.ProcessEnv;
	readonly repositoryRoot?: string;
}): string {
	const environment = input.environment ?? process.env;
	const repositoryRoot = input.repositoryRoot ?? rezicsRepositoryRoot();
	const candidates = [
		input.from,
		environment[ShowcasePacksDirectoryEnvironmentVariable],
		defaultSiblingShowcasePacksDir(repositoryRoot),
	].filter((value): value is string => Boolean(value && value.trim()));

	for (const candidate of candidates) {
		const resolved = resolve(candidate);
		if (isShowcasePacksRoot(resolved)) return resolved;
	}

	throw new ContentPackSourceNotFound(
		[
			"Showcase packs directory not found.",
			"Pass --from <dir>, set REZICS_SHOWCASE_PACKS_DIR, or clone rezics-showcase-packs next to rezics.",
			`Looked for packs/ under: ${candidates.map((value) => resolve(value)).join(", ") || "(no candidates)"}`,
		].join(" "),
	);
}
