import { describe, expect, it } from "vitest";

import { composeMigrationSql, planMigrationGeneration } from "./generate-database-migration";

describe("database migration transaction mode", () => {
	it("uses Atlas's transactional file mode by default", () => {
		expect(
			composeMigrationSql({
				schemaDiff: "CREATE TABLE example (id uuid PRIMARY KEY);",
			}),
		).toBe("SET search_path TO public;\n\nCREATE TABLE example (id uuid PRIMARY KEY);\n");
	});

	it("requires an explicit reason before composing concurrent DDL", () => {
		expect(() =>
			composeMigrationSql({
				preOverlay: "CREATE INDEX CONCURRENTLY example_idx ON public.example (id);",
			}),
		).toThrow(/\.txmode-none opt-in/);
	});

	it("emits txmode none only for an explicit non-empty opt-in", () => {
		expect(
			composeMigrationSql({
				preOverlay: "CREATE INDEX CONCURRENTLY example_idx ON public.example (id);",
				transactionModeNoneReason: "The index must remain writable while it is built.",
			}),
		).toBe(
			"-- atlas:txmode none\n\nCREATE INDEX CONCURRENTLY example_idx ON public.example (id);\n",
		);
	});

	it("allows independently resumable schema-anchored concurrent index statements", () => {
		expect(
			composeMigrationSql({
				preOverlay: [
					"-- Each statement is safe on a fresh connection.",
					"CREATE INDEX CONCURRENTLY example_idx ON public.example (id);",
					"DROP INDEX CONCURRENTLY IF EXISTS public.legacy_example_idx;",
				].join("\n"),
				transactionModeNoneReason: "Keep writes available.",
			}),
		).not.toContain("search_path");
	});

	it.each([
		"SET search_path TO public;\nCREATE INDEX CONCURRENTLY example_idx ON public.example (id);",
		"CREATE INDEX CONCURRENTLY example_idx ON example (id);",
		"CREATE INDEX CONCURRENTLY IF NOT EXISTS example_idx ON public.example (id);",
		"DROP INDEX CONCURRENTLY IF EXISTS legacy_example_idx;",
		"DROP INDEX public.legacy_example_idx;",
		"CREATE INDEX CONCURRENTLY public.example_idx ON public.example (id);",
		"CREATE INDEX CONCURRENTLY example_idx ON public.example ((hostile_fn(id)));",
		"CREATE INDEX CONCURRENTLY example_idx ON ONLY public.example (id);",
	])("rejects session-dependent or ambiguous resumable SQL: %s", (preOverlay) => {
		expect(() =>
			composeMigrationSql({
				preOverlay,
				transactionModeNoneReason: "Keep writes available.",
			}),
		).toThrow(/only dependency-free, schema-anchored CREATE\/DROP INDEX CONCURRENTLY/);
	});

	it("does not mistake comments, literals, identifiers, or function bodies for concurrent DDL", () => {
		expect(
			composeMigrationSql({
				schemaDiff: [
					"-- CONCURRENTLY is documented here.",
					"SELECT 'CONCURRENTLY';",
					'CREATE TABLE "CONCURRENTLY" (id integer);',
					"DO $body$ BEGIN RAISE NOTICE 'CONCURRENTLY'; END; $body$;",
				].join("\n"),
			}),
		).not.toContain("atlas:txmode none");
	});
});

describe("overlay-only migration generation", () => {
	it("retains shadow validation and schema discovery in standard mode", () => {
		expect(
			planMigrationGeneration({
				hasPreOverlay: true,
				hasPostOverlay: false,
				hasCanonicalFile: true,
			}),
		).toEqual({
			applyPreOverlayToShadow: true,
			includeCanonicalSql: true,
			runSchemaDiff: true,
		});
	});

	it("validates a pre overlay but skips schema diff and canonical SQL", () => {
		expect(
			planMigrationGeneration({
				hasPreOverlay: true,
				hasPostOverlay: false,
				hasCanonicalFile: false,
				overlayOnlyReason: "Isolate concurrent index DDL from the legacy schema cutover.",
			}),
		).toEqual({
			applyPreOverlayToShadow: true,
			includeCanonicalSql: false,
			runSchemaDiff: false,
		});
	});

	it("allows a post-only overlay without claiming shadow pre-validation", () => {
		expect(
			planMigrationGeneration({
				hasPreOverlay: false,
				hasPostOverlay: true,
				hasCanonicalFile: false,
				overlayOnlyReason: "The post overlay is verified by full migration replay.",
			}),
		).toEqual({
			applyPreOverlayToShadow: false,
			includeCanonicalSql: false,
			runSchemaDiff: false,
		});
	});

	it("rejects empty, content-free, and canonical overlay-only combinations", () => {
		const overlayOnly = {
			hasPreOverlay: true,
			hasPostOverlay: false,
			hasCanonicalFile: false,
		};
		expect(() => planMigrationGeneration({ ...overlayOnly, overlayOnlyReason: "  " })).toThrow(
			/reason is empty/,
		);
		expect(() =>
			planMigrationGeneration({
				...overlayOnly,
				hasPreOverlay: false,
				overlayOnlyReason: "A reason without SQL is unsafe.",
			}),
		).toThrow(/requires a \.pre\.sql or \.post\.sql/);
		expect(() =>
			planMigrationGeneration({
				...overlayOnly,
				hasCanonicalFile: true,
				overlayOnlyReason: "Canonical SQL must not be silently skipped.",
			}),
		).toThrow(/cannot be combined with canonical SQL/);
	});
});
