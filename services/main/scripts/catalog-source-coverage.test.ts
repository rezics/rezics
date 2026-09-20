import { describe, expect, it } from "vitest";
import {
	coverageEvidenceHash,
	evaluateSourceCoverage,
	parseCoverageInventory,
	sourceCoverageInventory,
	SourceCoverageManifestSchema,
} from "./catalog-source-coverage";
import { checkCatalogSourceCoverage } from "./check-catalog-source-coverage";

const fields = parseCoverageInventory([
	{
		source: "vndb",
		contract: "/vn",
		path: "title",
		shape: "documented_value",
		reference: null,
		repeated: null,
		nullable: null,
	},
	{
		source: "vndb",
		contract: "/vn",
		path: "staff.role",
		shape: "documented_value",
		reference: null,
		repeated: null,
		nullable: null,
	},
]);
const artifacts = [{ source: "vndb", sha256: "a".repeat(64) }];
const identity = { source: "vndb", contract: "/vn", path: "title" };
const reason = "Selected exact field has an explicit reviewed semantic disposition.";
const gap = {
	...identity,
	reason,
	disposition: "native",
	mapping: {
		status: "gap",
		requirement: "Native named form with source evidence.",
		gap: "Native edit/query/export evidence is not yet qualified.",
	},
};
const sourceOnly = { ...identity, path: "staff.role", reason, disposition: "source-only" };
const manifest = (entries: unknown[]) =>
	SourceCoverageManifestSchema.parse({
		format: "rezics.source-coverage.v2",
		entries: entries.map((entry) =>
			Object.assign(
				{
					sourceShape: {
						shape: "documented_value",
						reference: null,
						repeated: null,
						nullable: null,
					},
				},
				entry,
			),
		),
	});

describe("reviewed source coverage gate", () => {
	it("separates declarations, required native paths and unresolved coverage", () => {
		const result = evaluateSourceCoverage(fields, artifacts, manifest([gap]));
		expect(result.qualified).toBe(false);
		expect(result.nativeDenominator).toEqual({ reviewedRequiredPaths: 1, complete: false });
		expect(result.missing).toEqual(['["vndb","/vn","staff.role"]']);
		expect(result.nativeGaps).toEqual(['["vndb","/vn","title"]']);
		expect(result.nativeEvidenceRecorded).toBe(0);
	});

	it("does not let source-only or raw observations erase native gaps", () => {
		const result = evaluateSourceCoverage(fields, artifacts, manifest([gap, sourceOnly]));
		expect(result.nativeDenominator.complete).toBe(true);
		expect(result.qualified).toBe(false);
		expect(result.dispositions["source-only"]).toBe(1);
		expect(() =>
			manifest([
				{
					...gap,
					mapping: { status: "evidenced", representation: "raw-only", observation: "json" },
				},
			]),
		).toThrow();
	});

	it("rejects duplicate inventory identities and duplicate dispositions", () => {
		expect(() => parseCoverageInventory([fields[0], fields[0]])).toThrow("Duplicate source field");
		const result = evaluateSourceCoverage(fields, artifacts, manifest([gap, gap, sourceOnly]));
		expect(result.issues).toContain('Duplicate disposition: ["vndb","/vn","title"]');
		expect(result.qualified).toBe(false);
	});

	it("rejects wildcard and unknown entries instead of prefix covering descendants", () => {
		const result = evaluateSourceCoverage(fields, artifacts, manifest([{ ...gap, path: "*" }]));
		expect(result.issues).toContain('Removed or unknown source field: ["vndb","/vn","*"]');
		expect(result.missing).toHaveLength(2);
	});

	it("accepts fresh artifact bytes but diagnoses changed, new and removed fields", () => {
		const reviewed = manifest([gap, sourceOnly]);
		const refreshed = evaluateSourceCoverage(
			fields,
			[{ source: "vndb", sha256: "b".repeat(64) }],
			reviewed,
		);
		expect(refreshed.issues).toEqual([]);
		expect(refreshed.qualified).toBe(false); // The native gap remains independently visible.
		const changed = fields.map((field) => ({ ...field, nullable: true }));
		const result = evaluateSourceCoverage(changed, [], reviewed);
		expect(result.issues).toHaveLength(2);
		expect(result.issues.every((issue) => issue.startsWith("Source field shape drift:"))).toBe(
			true,
		);
		expect(result.qualified).toBe(false);
		const added = parseCoverageInventory([...fields, { ...fields[0], path: "new_field" }]);
		expect(evaluateSourceCoverage(added, artifacts, reviewed).missing).toContain(
			'["vndb","/vn","new_field"]',
		);
		expect(evaluateSourceCoverage(fields.slice(0, 1), artifacts, reviewed).issues).toContain(
			'Removed or unknown source field: ["vndb","/vn","staff.role"]',
		);
		expect(sourceCoverageInventory([...fields].reverse(), artifacts)).toEqual(
			sourceCoverageInventory(fields, artifacts),
		);
	});

	it("requires all native evidence roles and rejects traversal paths", () => {
		const evidence = {
			file: "services/native.ts",
			sha256: "a".repeat(64),
			anchor: "namedForm",
			claim: reason,
		};
		const mapping = {
			status: "evidenced",
			owner: "book",
			field: "namedForm",
			representation: "typed-relation",
			semantics: reason,
			evidence: {
				schema: evidence,
				canonicalWrite: evidence,
				nativeQuery: evidence,
				semanticExport: evidence,
			},
		};
		expect(() => manifest([{ ...gap, mapping }])).toThrow();
		expect(() =>
			manifest([
				{
					...gap,
					mapping: {
						...mapping,
						evidence: { ...mapping.evidence, fixture: { ...evidence, file: "../outside.ts" } },
					},
				},
			]),
		).toThrow();
	});

	it("records only hash-and-anchor-verified evidence and fails stale evidence", () => {
		const content =
			"namedForm\nwriteNamedForm\nqueryNamedForm\nexportNamedForm\nfixtureNamedForm\n";
		const reference = {
			file: "services/native.ts",
			sha256: coverageEvidenceHash(content),
			anchor: "namedForm",
			claim: reason,
		};
		const evidenced = {
			...gap,
			mapping: {
				status: "evidenced",
				owner: "book",
				field: "namedForm",
				representation: "typed-relation",
				semantics: reason,
				evidence: {
					schema: reference,
					canonicalWrite: { ...reference, anchor: "writeNamedForm" },
					nativeQuery: { ...reference, anchor: "queryNamedForm" },
					semanticExport: { ...reference, anchor: "exportNamedForm" },
					fixture: { ...reference, anchor: "fixtureNamedForm" },
				},
			},
		};
		const pinned = manifest([evidenced, sourceOnly]);
		const recorded = evaluateSourceCoverage(
			fields,
			artifacts,
			pinned,
			new Map([[reference.file, content.replace(/\n/gu, "\r\n")]]),
		);
		expect(recorded.qualified).toBe(true);
		expect(recorded.nativeEvidenceRecorded).toBe(1);
		expect(recorded.qualificationScope).toContain("runtime/schema acceptance is separate");
		const stale = evaluateSourceCoverage(
			fields,
			artifacts,
			pinned,
			new Map([[reference.file, `${content}// changed`]]),
		);
		expect(stale.qualified).toBe(false);
		expect(stale.nativeEvidenceRecorded).toBe(0);
		expect(stale.issues).toHaveLength(5);
		const absent = evaluateSourceCoverage(fields, artifacts, pinned);
		expect(absent.issues).toHaveLength(5);
		const reused = manifest([
			{
				...evidenced,
				mapping: {
					...evidenced.mapping,
					evidence: {
						schema: reference,
						canonicalWrite: reference,
						nativeQuery: reference,
						semanticExport: reference,
						fixture: reference,
					},
				},
			},
			sourceOnly,
		]);
		const rawOnly = evaluateSourceCoverage(
			fields,
			artifacts,
			reused,
			new Map([[reference.file, content]]),
		);
		expect(rawOnly.qualified).toBe(false);
		expect(
			rawOnly.issues.filter((issue) => issue.startsWith("Reused evidence location")),
		).toHaveLength(4);
	});

	it("fails a missing anchor even when the evidence file checksum is correct", () => {
		const content = "this document lacks the expected symbol";
		const reference = {
			file: "services/native.ts",
			sha256: coverageEvidenceHash(content),
			anchor: "namedForm",
			claim: reason,
		};
		const pinned = manifest([
			{
				...gap,
				mapping: {
					status: "evidenced",
					owner: "book",
					field: "namedForm",
					representation: "typed-column",
					semantics: reason,
					evidence: {
						schema: reference,
						canonicalWrite: reference,
						nativeQuery: reference,
						semanticExport: reference,
						fixture: reference,
					},
				},
			},
			sourceOnly,
		]);
		expect(
			evaluateSourceCoverage(fields, artifacts, pinned, new Map([[reference.file, content]]))
				.qualified,
		).toBe(false);
	});

	it("detects circular and absent structural/derived dependencies", () => {
		const structural = {
			...identity,
			reason,
			disposition: "structural",
			coveredBy: [{ ...identity, path: "staff.role" }],
		};
		const derived = {
			...identity,
			path: "staff.role",
			reason,
			disposition: "derived",
			inputs: [identity],
			derivation: "Explicit deterministic derivation of a reviewed fact.",
		};
		const circular = evaluateSourceCoverage(fields, artifacts, manifest([structural, derived]));
		expect(
			circular.issues.some((issue) => issue.startsWith("Circular disposition dependency")),
		).toBe(true);
		const absent = evaluateSourceCoverage(fields, artifacts, manifest([structural]));
		expect(absent.issues).toContain('Missing disposition dependency: ["vndb","/vn","staff.role"]');
	});

	it("keeps captured four-source coverage unqualified with explicit known gaps", async () => {
		const result = await checkCatalogSourceCoverage();
		for (const count of Object.values(result.inventory.declarations))
			expect(count).toBeGreaterThan(0);
		expect(result.acquisition.scope).toBe("all");
		expect(result.acquisition.runId).toBeTruthy();
		expect(result.issues).toEqual([]);
		expect(result.missing.length).toBeGreaterThan(0);
		expect(result.nativeGaps.length).toBeGreaterThan(0);
		expect(result.nativeEvidenceRecorded).toBe(0);
		expect(result.nativeDenominator.complete).toBe(false);
		expect(result.qualified).toBe(false);
	});
});
