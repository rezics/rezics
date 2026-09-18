import { z } from "zod";
import { CatalogNameValuesSchema, type CatalogNameInput } from "@rezics/schema/contracts/native/names";

/** @internal WS/2 aliases are unordered and have no stable alias ID; only exact native forms retain correspondence. */
export function correlateMusicBrainzNativeAliases(
	previous: readonly { path: string; value: CatalogNameInput }[],
	incoming: readonly CatalogNameInput[],
) {
	if (previous.length > 128 || incoming.length > 128)
		throw new RangeError("Music aliases require staged correspondence");
	const candidates = new Map<string, string[]>(),
		paths = new Set<string>();
	for (const row of [...previous].sort(
		(left, right) => Number(left.path.split("/")[2]) - Number(right.path.split("/")[2]),
	)) {
		z.string()
			.regex(/^\/aliases\/(?:0|[1-9][0-9]*)$/u)
			.max(512)
			.parse(row.path);
		if (paths.has(row.path)) throw new TypeError("Music alias source paths are ambiguous");
		paths.add(row.path);
		const key = JSON.stringify(CatalogNameValuesSchema.parse(row.value));
		const bucket = candidates.get(key) ?? [];
		bucket.push(row.path);
		candidates.set(key, bucket);
	}
	return incoming.map((value) =>
		candidates.get(JSON.stringify(CatalogNameValuesSchema.parse(value)))?.shift(),
	);
}
