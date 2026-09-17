import { createHash } from "node:crypto";
import { v5 } from "uuid";
import { IriSchema } from "./contracts";

// Public, immutable namespace. Its value is part of bundle format 1, not a deployment setting.
const namespace = v5("https://rezics.org/ns/schema/identity/v1", v5.URL);

/** @alpha Name-based identities are reproducible across deployments and database implementations. */
export function schemaId(kind: string, ...parts: string[]): string {
	return v5(JSON.stringify([kind, ...parts]), namespace);
}

/** @alpha Exact IRIs remain distinct unless an explicit imported alias declares otherwise. */
export function termId(iri: string): string {
	return schemaId("term", IriSchema.parse(iri));
}

/** @alpha Hash exact bytes for artifact integrity and canonical representations for semantic comparison. */
export function digest(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

/** @internal Stable object encoding; arrays keep their semantic order. */
export function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
	if (value !== null && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
			.join(",")}}`;
	}
	const result = JSON.stringify(value);
	if (result === undefined) throw new TypeError("Portable schema data cannot contain undefined");
	return result;
}
