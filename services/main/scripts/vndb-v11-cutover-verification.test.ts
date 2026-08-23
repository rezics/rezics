import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
	VndbV11CutoverVerificationInitialChecksum,
	VndbV11CutoverVerificationRelationValues,
} from "../src/services/database/schema/vndb-v11-cutover-verification";
import {
	adaptVndbV11VerificationBatchSize,
	buildVndbV11AggregateVerificationSqlManifest,
	buildVndbV11PrimaryPathBackfillSourceSql,
	buildVndbV11PrimaryPathProjectionBatchSql,
	buildVndbV11TimestampVerificationSqlManifest,
	deriveVndbV11CutoverProof,
	deriveVndbV11RelationProof,
	extendVndbV11VerificationChecksum,
	VndbV11PrimaryPathProjectionProofRelation,
	vndbV11VerificationErrorIsRetryable,
} from "./vndb-v11-cutover-verification";

const Epoch = 17n;
let canonicalGuardSource = "";
let prepareSource = "";

beforeAll(async () => {
	[canonicalGuardSource, prepareSource] = await Promise.all([
		readFile(
			new URL(
				"../src/services/database/schema/postgres/vndb-v11-cutover-verification.sql",
				import.meta.url,
			),
			"utf8",
		),
		readFile(
			new URL(
				"../src/services/database/schema/postgres/migration-overlays/vndb_v11_prepare.pre.sql",
				import.meta.url,
			),
			"utf8",
		),
	]);
});

function completedProofs() {
	return VndbV11CutoverVerificationRelationValues.map((relation, index) => {
		const verifiedRowCount = BigInt(index + 1);
		const checksum = extendVndbV11VerificationChecksum(VndbV11CutoverVerificationInitialChecksum, [
			JSON.stringify([relation, index]),
		]);
		return {
			checksum,
			relation,
			relationProof: deriveVndbV11RelationProof(Epoch, relation, verifiedRowCount, checksum),
			verifiedRowCount,
		};
	});
}

describe("VNDB v11 bounded cutover proof manifest", () => {
	it("fixes the exact nine proof relations without introducing the deferred Realm Path scope", () => {
		expect(VndbV11CutoverVerificationRelationValues).toEqual([
			"unit_structure_primary_path_backfill",
			"unit_structure_primary_path_projection",
			"unit_tag_judgment_timestamps",
			"unit_structure_application_judgment_timestamps",
			"realm_tag_judgment_timestamps",
			"unit_tag_judgment_stat",
			"unit_structure_application_judgment_stat",
			"realm_tag_judgment_stat",
			"subject_association_judgment_stat",
		]);
		expect(VndbV11PrimaryPathProjectionProofRelation).toBe(
			"unit_structure_primary_path_projection",
		);
	});

	it("chains deterministic checksums and binds every relation receipt to the paused epoch", () => {
		const first = extendVndbV11VerificationChecksum(VndbV11CutoverVerificationInitialChecksum, [
			"row-a",
			"row-b",
		]);
		const split = extendVndbV11VerificationChecksum(
			extendVndbV11VerificationChecksum(VndbV11CutoverVerificationInitialChecksum, ["row-a"]),
			["row-b"],
		);
		expect(first).toBe(split);
		expect(first).toMatch(/^[0-9a-f]{64}$/);

		const proofs = completedProofs();
		const proof = deriveVndbV11CutoverProof(Epoch, proofs);
		expect(proof).toMatch(/^[0-9a-f]{64}$/);
		expect(deriveVndbV11CutoverProof(Epoch, [...proofs].reverse())).toBe(proof);
		expect(() => deriveVndbV11CutoverProof(Epoch + 1n, proofs)).toThrow(
			"Invalid bounded verification relation proof",
		);
	});

	it("fails closed for an incomplete, duplicate, or tampered relation receipt", () => {
		const proofs = completedProofs();
		expect(() => deriveVndbV11CutoverProof(Epoch, proofs.slice(1))).toThrow(
			"requires every bounded verification relation",
		);
		expect(() => deriveVndbV11CutoverProof(Epoch, [...proofs.slice(0, -1), proofs[0]!])).toThrow(
			"relations must be unique",
		);
		expect(() =>
			deriveVndbV11CutoverProof(Epoch, [
				{ ...proofs[0]!, checksum: "f".repeat(64) },
				...proofs.slice(1),
			]),
		).toThrow("Invalid bounded verification relation proof");
	});
});

describe("VNDB v11 bounded verification SQL", () => {
	it("streams full physical keys without target-scoped aggregation", () => {
		const statements = buildVndbV11AggregateVerificationSqlManifest(true);
		expect(statements).toHaveLength(4);
		for (const statement of statements) {
			const normalized = statement.toLowerCase();
			expect(normalized).toContain("fact_stream as materialized");
			expect(normalized).toContain("source_phase");
			expect(normalized).toContain("source.profile_id");
			expect(normalized).toContain("order by");
			expect(normalized).toContain("limit $1");
			expect(normalized).toContain("::uuid");
			expect(normalized).not.toContain("left join lateral");
			expect(normalized).not.toContain("select distinct");
			expect(normalized).not.toContain("full join");
			expect(normalized).not.toContain("group by");
			expect(normalized).not.toContain(" offset ");
		}
	});

	it("keysets all sparse timestamp scans over their complete primary keys", () => {
		const statements = buildVndbV11TimestampVerificationSqlManifest(true);
		expect(statements).toHaveLength(3);
		expect(statements[0]).toContain('"source"."unit_id", "source"."tag_id", "source"."profile_id"');
		expect(statements[1]).toContain(
			'"source"."unit_id", "source"."structure_id", "source"."profile_id"',
		);
		expect(statements[2]).toContain(
			'"source"."realm_id", "source"."unit_id", "source"."tag_id", "source"."profile_id"',
		);
		for (const statement of statements) {
			expect(statement).toContain("limit $1");
			expect(statement.toLowerCase()).not.toContain(" offset ");
		}
	});

	it("bounds both primary Path source and final display scans", () => {
		const source = buildVndbV11PrimaryPathBackfillSourceSql(true).toLowerCase();
		expect(source).toContain("where structure.id > $2::uuid");
		expect(source).toContain("order by structure.id");
		expect(source).toContain("limit $1");

		const projection = buildVndbV11PrimaryPathProjectionBatchSql(true).toLowerCase();
		expect(projection).toContain("projection_stream as materialized");
		expect(projection).toContain("source.final_tag_id, 0::smallint, source.structure_id");
		expect(projection).toContain("source.tag_id, 1::smallint, source.structure_id");
		expect(projection).toContain("$5::integer");
		expect(projection).not.toContain("select distinct");
		expect(projection).not.toContain("left join lateral");
		expect(projection).not.toContain("full join");
		expect(projection).not.toContain(" offset ");
	});
});

describe("VNDB v11 verification retry and adaptation", () => {
	it.each(["40001", "40P01", "55P03", "57014"])(
		"recognizes retryable PostgreSQL code %s",
		(code) => {
			expect(vndbV11VerificationErrorIsRetryable({ code })).toBe(true);
		},
	);

	it("does not retry semantic failures and keeps adaptive batches within bounds", () => {
		expect(vndbV11VerificationErrorIsRetryable({ code: "23514" })).toBe(false);
		expect(adaptVndbV11VerificationBatchSize(10_000, 10_000, 501)).toBe(5_000);
		expect(adaptVndbV11VerificationBatchSize(1, 10_000, 501)).toBe(1);
		expect(adaptVndbV11VerificationBatchSize(5_000, 10_000, 249)).toBe(10_000);
		expect(adaptVndbV11VerificationBatchSize(10_000, 10_000, 249)).toBe(10_000);
		expect(adaptVndbV11VerificationBatchSize(5_000, 10_000, 400)).toBe(5_000);
	});
});

describe("VNDB v11 durable evidence guards", () => {
	it("database-enforces current paused epochs and immutable completed evidence", () => {
		expect(canonicalGuardSource).toContain("transition.state = 'paused'");
		expect(canonicalGuardSource).toContain("control.state = 'paused'");
		expect(canonicalGuardSource).toContain("OLD.relation_proof IS NOT NULL");
		expect(canonicalGuardSource).toContain(
			"BEFORE DELETE ON public.vndb_v11_cutover_verification_checkpoint",
		);
		expect(canonicalGuardSource).toContain(
			"BEFORE TRUNCATE ON public.vndb_v11_cutover_verification_checkpoint",
		);
		expect(canonicalGuardSource).toContain(
			"BEFORE UPDATE OR DELETE ON public.vndb_v11_cutover_verification_proof",
		);
		expect(canonicalGuardSource).toContain("completed_count <> 9");
	});

	it("separates online primary-Path progress from paused proof without a rebuild", () => {
		expect(prepareSource).toContain("vndb_v11_primary_path_backfill_progress");
		expect(prepareSource).toContain("vndb_v11_primary_path_dirty_key");
		expect(prepareSource).toContain("vndb_v11_cutover_transition_mutation_protect");
		expect(prepareSource).not.toContain("truncate table public.tag_primary_display_path");
	});
});
