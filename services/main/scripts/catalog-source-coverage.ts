import { createHash } from "node:crypto";
import { z } from "zod";
import {
	assertUniqueSourceFields,
	canonicalContractHash,
	CatalogSourceValues,
	SourceContractFieldSchema,
	type SourceContractField,
} from "@rezics/schema-importer/readers/provider-contracts";

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
const common = { ...identitySchema.shape, reason: explanation };
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
	format: z.literal("rezics.source-coverage.v1"),
	inventory: z.strictObject({
		fieldsSha256: sha256,
		artifactsSha256: sha256,
		declarations: z.strictObject({
			bangumi: z.number().int().nonnegative(),
			vndb: z.number().int().nonnegative(),
			musicbrainz: z.number().int().nonnegative(),
			openlibrary: z.number().int().nonnegative(),
		}),
	}),
	entries: z.array(dispositionSchema).max(20_000),
});
export type SourceCoverageManifest = z.infer<typeof SourceCoverageManifestSchema>;
type Identity = z.infer<typeof identitySchema>;

/** @internal Exact tuple identity; no wildcard, regex, prefix or inferred mappings. */
export function sourceFieldKey(field: Identity): string {
	return JSON.stringify([field.source, field.contract, field.path]);
}

/** @internal Validate before hashing; order and platform line endings do not change the pin. */
export function parseCoverageInventory(value: unknown): SourceContractField[] {
	const fields = z.array(SourceContractFieldSchema).min(1).max(20_000).parse(value);
	assertUniqueSourceFields(fields);
	return fields;
}

/** @internal Pins declarations separately from the reviewed native-fact denominator. */
export function sourceCoveragePin(fields: readonly SourceContractField[], artifacts: unknown) {
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
	const pin = sourceCoveragePin(fields, artifacts);
	const issues: string[] = [];
	if (manifest.inventory.fieldsSha256 !== pin.fieldsSha256)
		issues.push("Inventory field hash drift");
	if (manifest.inventory.artifactsSha256 !== pin.artifactsSha256)
		issues.push("Artifact pin hash drift");
	for (const source of CatalogSourceValues)
		if (manifest.inventory.declarations[source] !== pin.declarations[source])
			issues.push(`Declaration count drift: ${source}`);
	const inventoryKeys = new Set(fields.map(sourceFieldKey));
	const entries = new Map<string, SourceCoverageManifest["entries"][number]>();
	for (const entry of manifest.entries) {
		const key = sourceFieldKey(entry);
		if (entries.has(key)) issues.push(`Duplicate disposition: ${key}`);
		if (!inventoryKeys.has(key)) issues.push(`Unknown source field: ${key}`);
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
		format: "rezics.source-coverage-result.v1" as const,
		qualified: denominatorComplete && nativeGaps.length === 0,
		qualificationScope:
			"Reviewed declaration dispositions and evidence integrity only; runtime/schema acceptance is separate.",
		inventory: pin,
		reviewedDeclarations: entries.size,
		dispositions,
		nativeDenominator: { reviewedRequiredPaths: requiredNative, complete: denominatorComplete },
		nativeEvidenceRecorded,
		missing,
		nativeGaps,
		issues,
	};
}
