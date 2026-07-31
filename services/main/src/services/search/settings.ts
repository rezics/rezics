import { createHash } from "node:crypto";

import currentSettings from "./settings/current-v10.json";
import historySettings from "./settings/history-v1.json";

import type { SearchProjectionKind } from "../database/schema/search";

export type { SearchProjectionKind };

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	return `{${Object.entries(value)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
		.join(",")}}`;
}

export const SearchProjectionSettings = {
	current: currentSettings,
	history: historySettings,
} as const;

export function getSearchSettingsFingerprint(kind: SearchProjectionKind): string {
	return createHash("sha256").update(canonicalJson(SearchProjectionSettings[kind])).digest("hex");
}
