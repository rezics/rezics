import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../pagination/errors";
import {
	decodeSubjectAssociationCursor,
	encodeSubjectAssociationCursor,
} from "./subject-association-cursor";

const context = {
	unitId: "019b76da-a800-7300-8000-000000000001",
	localizationLanguages: ["ja", "en"],
	limit: 8,
} as const;

describe("subject association cursor", () => {
	it("round-trips the indexed position and UUID boundary", () => {
		const boundary = {
			position: "a1",
			id: "019b76da-a800-7300-8000-000000000002",
		};
		expect(
			decodeSubjectAssociationCursor(encodeSubjectAssociationCursor(boundary, context), context),
		).toEqual(boundary);
	});

	it("rejects a cursor reused with a different request context", () => {
		const cursor = encodeSubjectAssociationCursor(
			{ position: "a1", id: "019b76da-a800-7300-8000-000000000002" },
			context,
		);
		expect(() =>
			decodeSubjectAssociationCursor(cursor, { ...context, localizationLanguages: ["en"] }),
		).toThrow(InvalidPaginationCursor);
	});

	it("rejects malformed input", () => {
		expect(() => decodeSubjectAssociationCursor("not-a-cursor", context)).toThrow(
			InvalidPaginationCursor,
		);
	});
});
