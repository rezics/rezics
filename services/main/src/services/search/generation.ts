import { and, eq } from "drizzle-orm";

import { database } from "../database";
import { searchIndexGeneration } from "../database/schema";
import { SearchProjectionVersions } from "./contracts";
import { SearchUnavailable } from "./errors";
import { getSearchSettingsFingerprint, type SearchProjectionKind } from "./settings";

export interface ActiveSearchGeneration {
	readonly id: string;
	readonly kind: SearchProjectionKind;
	readonly indexUid: string;
	readonly projectionVersion: number;
	readonly settingsFingerprint: string;
}

const cache = new Map<
	SearchProjectionKind,
	{ expiresAt: number; generation: ActiveSearchGeneration }
>();
const ActiveGenerationCacheMs = 1_000;

export function clearActiveSearchGenerationCache(): void {
	cache.clear();
}

export async function getActiveSearchGeneration(
	kind: SearchProjectionKind,
): Promise<ActiveSearchGeneration> {
	const cached = cache.get(kind);
	if (cached && cached.expiresAt > Date.now()) return cached.generation;
	const [row] = await database
		.select({
			id: searchIndexGeneration.id,
			indexUid: searchIndexGeneration.indexUid,
			projectionVersion: searchIndexGeneration.projectionVersion,
			settingsFingerprint: searchIndexGeneration.settingsFingerprint,
		})
		.from(searchIndexGeneration)
		.where(
			and(
				eq(searchIndexGeneration.projectionKind, kind),
				eq(searchIndexGeneration.state, "active"),
			),
		)
		.limit(1);
	if (!row) throw new SearchUnavailable(new Error(`No active ${kind} search generation`));
	const expectedFingerprint = getSearchSettingsFingerprint(kind);
	if (
		row.projectionVersion !== SearchProjectionVersions[kind] ||
		row.settingsFingerprint !== expectedFingerprint
	)
		throw new SearchUnavailable(
			new Error(`Active ${kind} search generation contract does not match this application`),
		);
	const generation = { ...row, kind } satisfies ActiveSearchGeneration;
	cache.set(kind, { expiresAt: Date.now() + ActiveGenerationCacheMs, generation });
	return generation;
}
