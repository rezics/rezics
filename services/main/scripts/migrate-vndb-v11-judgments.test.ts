import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
	assertConcurrentMigrationResumeSafe,
	classifyLedgerMatchedState,
	cutoverControlRowIsValid,
	parseOptions,
} from "./migrate-vndb-v11-judgments";

let concurrentOverlay = "";

beforeAll(async () => {
	concurrentOverlay = await readFile(
		new URL(
			"../src/services/database/schema/postgres/migration-overlays/vndb_v11_concurrent_indexes.pre.sql",
			import.meta.url,
		),
		"utf8",
	);
});

function replaceRequired(source: string, from: string, to: string): string {
	if (!source.includes(from)) throw new Error(`Test fixture is missing ${from}`);
	return source.replace(from, to);
}

describe("VNDB v11 cutover runner options", () => {
	it.each(["pause", "resume"] as const)(
		"accepts an attributed, confirmed %s transition",
		(mode) => {
			expect(
				parseOptions([
					"--mode",
					mode,
					"--yes",
					"--operator",
					"  migration-operator  ",
					"--reason",
					"  reviewed cutover transition  ",
				]),
			).toEqual({
				batchSize: 10_000,
				confirmed: true,
				expectedState: undefined,
				help: false,
				mode,
				operator: "migration-operator",
				reason: "reviewed cutover transition",
				requireDrained: false,
			});
		},
	);

	it("accepts the explicit prepare-constraint validation phase", () => {
		expect(parseOptions(["--mode", "validate-prepare", "--yes"])).toMatchObject({
			confirmed: true,
			mode: "validate-prepare",
			operator: undefined,
			reason: undefined,
		});
	});

	it.each(["pause", "resume"] as const)("requires complete operator attribution for %s", (mode) => {
		expect(() => parseOptions(["--mode", mode, "--operator", "migration-operator"])).toThrow(
			/requires both --operator and --reason/,
		);
	});
});

describe("VNDB v11 cutover-control row contract", () => {
	it.each([
		["0", null, null],
		["1", "migration-operator", "reviewed abort"],
		["37", "migration-operator", "reviewed retry"],
	] as const)(
		"accepts a retry-safe precontract-open row at epoch %s",
		(transitionEpoch, operator, reason) => {
			expect(
				cutoverControlRowIsValid({
					operator,
					reason,
					state: "precontract_open",
					stateChangedAt: "2026-08-24T00:00:00.000Z",
					transitionEpoch,
				}),
			).toBe(true);
		},
	);

	it("requires positive attributed epochs once the fence leaves precontract-open", () => {
		const row = {
			operator: "migration-operator",
			reason: "reviewed transition",
			stateChangedAt: "2026-08-24T00:00:00.000Z",
			transitionEpoch: "1",
		} as const;

		expect(cutoverControlRowIsValid({ ...row, state: "paused" })).toBe(true);
		expect(cutoverControlRowIsValid({ ...row, state: "postcontract_open" })).toBe(true);
		expect(cutoverControlRowIsValid({ ...row, state: "paused", transitionEpoch: "0" })).toBe(false);
		expect(cutoverControlRowIsValid({ ...row, state: "paused", reason: "   " })).toBe(false);
		expect(
			cutoverControlRowIsValid({
				...row,
				state: "precontract_open",
				operator: "migration-operator",
			}),
		).toBe(true);
		expect(
			cutoverControlRowIsValid({
				...row,
				state: "precontract_open",
				operator: null,
				reason: null,
			}),
		).toBe(false);
	});
});

describe("VNDB v11 Atlas ledger and structural-state agreement", () => {
	it.each([
		["legacy", { prepare: "pending", preindex: "pending", contract: "pending" }],
		["prepared", { prepare: "complete", preindex: "pending", contract: "pending" }],
		["preindexed", { prepare: "complete", preindex: "complete", contract: "pending" }],
		["final", { prepare: "complete", preindex: "complete", contract: "complete" }],
	] as const)("retains the proved %s state", (state, ledgerKinds) => {
		expect(classifyLedgerMatchedState(state, true, ledgerKinds)).toBe(state);
	});

	it("keeps a structurally partial state partial", () => {
		expect(
			classifyLedgerMatchedState("partial", true, {
				prepare: "complete",
				preindex: "complete",
				contract: "complete",
			}),
		).toBe("partial");
	});

	it.each([
		{ prepare: "partial", preindex: "pending", contract: "pending" },
		{ prepare: "complete", preindex: "partial", contract: "pending" },
		{ prepare: "complete", preindex: "complete", contract: "partial" },
		{ prepare: undefined, preindex: "pending", contract: "pending" },
	] as const)("rejects incomplete or partial ledger evidence: %o", (ledgerKinds) => {
		expect(classifyLedgerMatchedState("final", true, ledgerKinds)).toBe("partial");
	});

	it("rejects structural claims when the Atlas ledger is absent", () => {
		expect(
			classifyLedgerMatchedState("legacy", false, {
				prepare: "pending",
				preindex: "pending",
				contract: "pending",
			}),
		).toBe("partial");
	});
});

describe("VNDB v11 concurrent-index replay grammar", () => {
	it("accepts the reviewed overlay as exactly 18 CREATE and 5 DROP operations", () => {
		const statements = assertConcurrentMigrationResumeSafe(concurrentOverlay);

		expect(statements).toHaveLength(23);
		expect(statements.filter((statement) => statement.startsWith("create "))).toHaveLength(18);
		expect(statements.filter((statement) => statement.startsWith("drop "))).toHaveLength(5);
		expect(statements.at(0)).toBe(
			"create index concurrently unit_tag_judgment_tag_unit_idx on public.unit_tag_vote (tag_id, unit_id)",
		);
		expect(statements.at(-1)).toBe(
			"drop index concurrently if exists public.unit_tag_structure_support_structure_idx",
		);
	});

	it.each([
		["session state", (source: string) => `SET search_path TO public;\n${source}`],
		[
			"an unqualified relation",
			(source: string) => replaceRequired(source, "ON public.unit_tag_vote", "ON unit_tag_vote"),
		],
		[
			"IF NOT EXISTS on CREATE",
			(source: string) =>
				replaceRequired(
					source,
					"CREATE INDEX CONCURRENTLY unit_tag_judgment_tag_unit_idx",
					"CREATE INDEX CONCURRENTLY IF NOT EXISTS unit_tag_judgment_tag_unit_idx",
				),
		],
		[
			"ONLY on CREATE",
			(source: string) =>
				replaceRequired(source, "ON public.unit_tag_vote", "ON ONLY public.unit_tag_vote"),
		],
	] as const)("rejects %s in the reviewed replay file", (_name, mutate) => {
		expect(() => assertConcurrentMigrationResumeSafe(mutate(concurrentOverlay))).toThrow(
			/reviewed schema-anchored operation|Expected 23 concurrent-index statements/,
		);
	});

	it("rejects a non-terminated final statement", () => {
		expect(() =>
			assertConcurrentMigrationResumeSafe(concurrentOverlay.trimEnd().slice(0, -1)),
		).toThrow(/must terminate every statement/);
	});
});
