import { createHash } from "node:crypto";
import { z } from "zod";
import {
	assertUniqueSourceFields,
	canonicalContractHash,
	CatalogSourceValues,
	SourceContractFieldSchema,
	type SourceContractField,
} from "@rezics/content-adapters/readers/provider-contracts";

const explanation = z.string().trim().min(20).max(4_000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u);
const identitySchema = z.strictObject({
	source: z.enum(CatalogSourceValues),
	contract: z.string().min(1).max(512),
	path: z.string().min(1).max(2_048),
});
const evidenceSchema = z.strictObject({
	file: z
		.string()
		.min(1)
		.max(512)
		.refine(
			(file) =>
				!file.includes("\\") &&
				!file.includes(":") &&
				!file.startsWith("/") &&
				file.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
			"Evidence must use a repository-relative file path",
		),
	sha256,
	anchor: z.string().trim().min(8).max(1_000),
	claim: explanation,
});
const nativeMappingSchema = z.discriminatedUnion("status", [
	z.strictObject({ status: z.literal("gap"), requirement: explanation, gap: explanation }),
	z.strictObject({
		status: z.literal("evidenced"),
		owner: z.string().min(1).max(256),
		field: z.string().min(1).max(256),
		// A raw payload or source-shaped observation is not a native mapping.
		representation: z.enum(["typed-column", "typed-relation"]),
		semantics: explanation,
		evidence: z.strictObject({
			schema: evidenceSchema,
			canonicalWrite: evidenceSchema,
			nativeQuery: evidenceSchema,
			semanticExport: evidenceSchema,
			fixture: evidenceSchema,
		}),
	}),
]);
const common = {
	...identitySchema.shape,
	sourceShape: SourceContractFieldSchema.omit({ source: true, contract: true, path: true }),
	reason: explanation,
};
const dispositionSchema = z.discriminatedUnion("disposition", [
	z.strictObject({ ...common, disposition: z.literal("native"), mapping: nativeMappingSchema }),
	z.strictObject({ ...common, disposition: z.literal("source-only") }),
	z.strictObject({ ...common, disposition: z.literal("out-of-scope") }),
	z.strictObject({
		...common,
		disposition: z.literal("structural"),
		coveredBy: z.array(identitySchema).min(1).max(256),
	}),
	z.strictObject({
		...common,
		disposition: z.literal("derived"),
		inputs: z.array(identitySchema).min(1).max(256),
		derivation: explanation,
	}),
]);

/** @internal The declaration inventory is bounded schema metadata, never corpus rows. */
export const SourceCoverageManifestSchema = z.strictObject({
	format: z.literal("rezics.source-coverage.v2"),
	entries: z.array(dispositionSchema).max(20_000),
});
export type SourceCoverageManifest = z.infer<typeof SourceCoverageManifestSchema>;
type Identity = z.infer<typeof identitySchema>;

/** @internal Exact tuple identity; no wildcard, regex, prefix or inferred mappings. */
export function sourceFieldKey(field: Identity): string {
	return JSON.stringify([field.source, field.contract, field.path]);
}

/** @internal Validate before hashing; order and platform line endings do not change the recorded digest. */
export function parseCoverageInventory(value: unknown): SourceContractField[] {
	const fields = z.array(SourceContractFieldSchema).min(1).max(20_000).parse(value);
	assertUniqueSourceFields(fields);
	return fields;
}

/** @internal Describes the observed inventory separately from the reviewed native-fact denominator. */
export function sourceCoverageInventory(
	fields: readonly SourceContractField[],
	artifacts: unknown,
) {
	const declarations = { bangumi: 0, vndb: 0, musicbrainz: 0, openlibrary: 0 };
	for (const field of fields) declarations[field.source]++;
	return {
		fieldsSha256: canonicalContractHash(
			[...fields].sort((left, right) => {
				const a = sourceFieldKey(left),
					b = sourceFieldKey(right);
				return a < b ? -1 : a > b ? 1 : 0;
			}),
		),
		artifactsSha256: canonicalContractHash(artifacts),
		declarations,
	};
}

/** @internal Hash evidence text with normalized line endings across Git checkouts. */
export function coverageEvidenceHash(text: string): string {
	return createHash("sha256").update(text.replace(/\r\n/gu, "\n")).digest("hex");
}

/**
 * @internal
 * Checks reviewed dispositions and pinned evidence integrity. This does not execute
 * acceptance tests, infer semantics from source code, or qualify a database schema.
 */
export function evaluateSourceCoverage(
	fields: readonly SourceContractField[],
	artifacts: unknown,
	manifest: SourceCoverageManifest,
	evidenceFiles: ReadonlyMap<string, string> = new Map(),
) {
	assertUniqueSourceFields(fields);
	const inventory = sourceCoverageInventory(fields, artifacts);
	const issues: string[] = [];
	const inventoryFields = new Map(fields.map((field) => [sourceFieldKey(field), field]));
	const inventoryKeys = new Set(inventoryFields.keys());
	const entries = new Map<string, SourceCoverageManifest["entries"][number]>();
	for (const entry of manifest.entries) {
		const key = sourceFieldKey(entry);
		if (entries.has(key)) issues.push(`Duplicate disposition: ${key}`);
		if (!inventoryKeys.has(key)) issues.push(`Removed or unknown source field: ${key}`);
		const observed = inventoryFields.get(key);
		if (observed) {
			const { source: _source, contract: _contract, path: _path, ...shape } = observed;
			if (canonicalContractHash(shape) !== canonicalContractHash(entry.sourceShape))
				issues.push(
					`Source field shape drift: ${key}; expected ${JSON.stringify(entry.sourceShape)}, observed ${JSON.stringify(shape)}`,
				);
		}
		entries.set(key, entry);
	}
	const missing = fields.filter((field) => !entries.has(sourceFieldKey(field))).map(sourceFieldKey);
	const normalizedEvidence = new Map(
		[...evidenceFiles].map(([file, text]) => {
			const content = text.replace(/\r\n/gu, "\n");
			return [file, { content, hash: coverageEvidenceHash(content) }] as const;
		}),
	);
	const nativeGaps: string[] = [];
	let nativeEvidenceRecorded = 0;
	let requiredNative = 0;
	const dispositions = {
		native: 0,
		"source-only": 0,
		"out-of-scope": 0,
		structural: 0,
		derived: 0,
	};
	for (const [key, entry] of entries) {
		dispositions[entry.disposition]++;
		if (entry.disposition === "native") {
			requiredNative++;
			if (entry.mapping.status === "gap") {
				nativeGaps.push(key);
				continue;
			}
			let evidenceValid = true;
			const roleLocations = new Set<string>();
			for (const [role, reference] of Object.entries(entry.mapping.evidence)) {
				const content = normalizedEvidence.get(reference.file);
				const anchor = reference.anchor.replace(/\r\n/gu, "\n");
				const location = JSON.stringify([reference.file, anchor]);
				if (roleLocations.has(location)) {
					issues.push(`Reused evidence location for ${role}: ${key}`);
					evidenceValid = false;
				}
				roleLocations.add(location);
				if (
					content === undefined ||
					content.hash !== reference.sha256 ||
					!content.content.includes(anchor)
				) {
					issues.push(`Missing or stale ${role} evidence: ${key} (${reference.file})`);
					evidenceValid = false;
				}
			}
			if (evidenceValid) nativeEvidenceRecorded++;
		}
	}
	// Iterative traversal bounds stack usage and catches circular attempts to dispose
	// of wrappers/derived fields without ultimately reaching a concrete disposition.
	const complete = new Set<string>();
	for (const key of entries.keys()) {
		const active = new Set<string>();
		const stack: { key: string; leaving: boolean }[] = [{ key, leaving: false }];
		while (stack.length) {
			const item = stack.pop();
			if (!item) break;
			if (item.leaving) {
				active.delete(item.key);
				complete.add(item.key);
				continue;
			}
			if (active.has(item.key)) {
				issues.push(`Circular disposition dependency: ${item.key}`);
				continue;
			}
			if (complete.has(item.key)) continue;
			const entry = entries.get(item.key);
			if (!entry) {
				issues.push(`Missing disposition dependency: ${item.key}`);
				complete.add(item.key);
				continue;
			}
			active.add(item.key);
			stack.push({ key: item.key, leaving: true });
			const dependencies =
				entry.disposition === "structural"
					? entry.coveredBy
					: entry.disposition === "derived"
						? entry.inputs
						: [];
			for (const dependency of dependencies)
				stack.push({ key: sourceFieldKey(dependency), leaving: false });
		}
	}
	const denominatorComplete = missing.length === 0 && issues.length === 0;
	return {
		format: "rezics.source-coverage-result.v2" as const,
		qualified: denominatorComplete && nativeGaps.length === 0,
		qualificationScope:
			"Reviewed declaration dispositions and evidence integrity only; runtime/schema acceptance is separate.",
		inventory,
		reviewedDeclarations: entries.size,
		dispositions,
		nativeDenominator: { reviewedRequiredPaths: requiredNative, complete: denominatorComplete },
		nativeEvidenceRecorded,
		missing,
		nativeGaps,
		issues,
	};
}
