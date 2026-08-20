import { normalizeContentLanguageSupport } from "@rezics/content-language";
import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../pagination/errors";
import {
	contentLanguageEvidenceSourcesForUnitKind,
	decodeContentLanguageEvidenceCursor,
	encodeContentLanguageEvidenceCursor,
	finalizeContentLanguageEvidencePage,
	releaseParentContentLanguageEvidenceQuery,
} from "./content-language-evidence";

const unitId = "01941f29-7c00-79b7-a3a2-b25051a604f8";
const structureId = "01941f29-7c00-79b7-a3a2-b25051a604f9";

describe("content language evidence cursors", () => {
	it("resolves Release evidence with one bounded direct-parent lookup", () => {
		const query = releaseParentContentLanguageEvidenceQuery({
			releaseUnitId: unitId,
			profileId: structureId,
		}).toSQL();
		const normalizedSql = query.sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(normalizedSql).toContain('from "release" inner join "unit"');
		expect(normalizedSql).toContain('"release"."id" =');
		expect(normalizedSql).toContain('"unit"."id" = "release"."parent_unit_id"');
		expect(normalizedSql).toContain("limit");
		expect(query.params).toContain(unitId);
		expect(query.params).toContain(1);
	});

	it("omits a candidate lost during authorization hydration and advances its cursor", () => {
		const result = finalizeContentLanguageEvidencePage({
			candidates: [
				{
					source: "variant",
					unitId,
					unitKind: "book",
					occurrence: null,
					cursor: {
						version: 1,
						source: "variant",
						ownerUnitId: structureId,
						createdAt: "2026-08-20T01:02:03.000Z",
						unitId,
					},
				},
				{
					source: "variant",
					unitId: structureId,
					unitKind: "book",
					occurrence: null,
					cursor: {
						version: 1,
						source: "variant",
						ownerUnitId: structureId,
						createdAt: "2026-08-20T01:02:04.000Z",
						unitId: structureId,
					},
				},
			],
			limit: 1,
			presentations: [],
			supportByUnitId: new Map([
				[unitId, normalizeContentLanguageSupport([{ languageTag: "ja" }])],
			]),
		});

		expect(result.items).toEqual([]);
		expect(decodeContentLanguageEvidenceCursor(result.nextCursor ?? undefined)).toEqual({
			version: 1,
			source: "variant",
			ownerUnitId: structureId,
			createdAt: "2026-08-20T01:02:03.000Z",
			unitId,
		});
	});

	it("keeps evidence sources inside each direct domain boundary", () => {
		expect(contentLanguageEvidenceSourcesForUnitKind("release")).toEqual(["parent"]);
		expect(contentLanguageEvidenceSourcesForUnitKind("book")).toEqual(["main", "variant"]);
		expect(contentLanguageEvidenceSourcesForUnitKind("software")).toEqual([
			"main",
			"variant",
			"release",
		]);
		expect(contentLanguageEvidenceSourcesForUnitKind("media")).toEqual([
			"main",
			"variant",
			"occurrence",
		]);
		expect(contentLanguageEvidenceSourcesForUnitKind("video")).toEqual(["adapted_audio"]);
		expect(contentLanguageEvidenceSourcesForUnitKind("audio")).toEqual([]);
	});

	it("round-trips every bounded source boundary", () => {
		const values = [
			{ version: 1, source: "parent", ownerUnitId: unitId },
			{ version: 1, source: "main", ownerUnitId: unitId },
			{
				version: 1,
				source: "variant",
				ownerUnitId: unitId,
				createdAt: "2026-08-20T01:02:03.000Z",
				unitId,
			},
			{ version: 1, source: "release", ownerUnitId: unitId, releasedOn: null, unitId },
			{
				version: 1,
				source: "occurrence",
				ownerUnitId: unitId,
				structureId,
				nodeId: unitId,
			},
			{ version: 1, source: "adapted_audio", ownerUnitId: unitId, unitId: structureId },
		] as const;

		for (const value of values)
			expect(
				decodeContentLanguageEvidenceCursor(encodeContentLanguageEvidenceCursor(value)),
			).toEqual(value);
		expect(decodeContentLanguageEvidenceCursor()).toBeUndefined();
	});

	it("binds a cursor to its edited Unit", () => {
		const cursor = encodeContentLanguageEvidenceCursor({
			version: 1,
			source: "main",
			ownerUnitId: unitId,
		});
		expect(() => decodeContentLanguageEvidenceCursor(cursor, structureId)).toThrow(
			InvalidPaginationCursor,
		);
	});

	it("rejects malformed, unknown, and non-keyset cursors", () => {
		for (const value of [
			"not-json",
			Buffer.from(JSON.stringify({ version: 1, source: "tree", unitId })).toString("base64url"),
			Buffer.from(
				JSON.stringify({ version: 1, source: "variant", createdAt: "never", unitId }),
			).toString("base64url"),
			Buffer.from(
				JSON.stringify({ version: 1, source: "release", releasedOn: null, unitId, offset: 2 }),
			).toString("base64url"),
		])
			expect(() => decodeContentLanguageEvidenceCursor(value)).toThrow(InvalidPaginationCursor);
	});
});
