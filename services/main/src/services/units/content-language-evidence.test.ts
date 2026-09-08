import { normalizeContentLanguageSupport } from "@rezics/content-language";
import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../pagination/errors";
import {
	contentLanguageEvidenceSourcesForUnitKind,
	decodeContentLanguageEvidenceCursor,
	encodeContentLanguageEvidenceCursor,
	finalizeContentLanguageEvidencePage,
} from "./content-language-evidence";

const unitId = "01941f29-7c00-79b7-a3a2-b25051a604f8";
const structureId = "01941f29-7c00-79b7-a3a2-b25051a604f9";

describe("content language evidence cursors", () => {
	it("omits a candidate lost during authorization hydration and advances its cursor", () => {
		const result = finalizeContentLanguageEvidencePage({
			candidates: [
				{
					source: "adapted_audio",
					unitId,
					unitKind: "audio",
					occurrence: null,
					cursor: {
						version: 1,
						source: "adapted_audio",
						ownerUnitId: structureId,
						unitId,
					},
				},
				{
					source: "adapted_audio",
					unitId: structureId,
					unitKind: "audio",
					occurrence: null,
					cursor: {
						version: 1,
						source: "adapted_audio",
						ownerUnitId: structureId,
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
			source: "adapted_audio",
			ownerUnitId: structureId,
			unitId,
		});
	});

	it("keeps evidence sources inside each direct domain boundary", () => {
		expect(contentLanguageEvidenceSourcesForUnitKind("video")).toEqual(["adapted_audio"]);
		expect(contentLanguageEvidenceSourcesForUnitKind("audio")).toEqual([]);
	});

	it("round-trips every bounded source boundary", () => {
		const values = [
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
			source: "adapted_audio",
			unitId: structureId,
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
				JSON.stringify({ version: 1, source: "adapted_audio", createdAt: "never", unitId }),
			).toString("base64url"),
			Buffer.from(
				JSON.stringify({ version: 1, source: "release", releasedOn: null, unitId, offset: 2 }),
			).toString("base64url"),
		])
			expect(() => decodeContentLanguageEvidenceCursor(value)).toThrow(InvalidPaginationCursor);
	});
});
