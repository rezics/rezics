import { describe, expect, it } from "vitest";

import { subjectAssociationMediaKind } from "../model/subject-association-presentation";

describe("subjectAssociationMediaKind", () => {
	it("uses a cover for every Entity kind when one is available", () => {
		expect(
			subjectAssociationMediaKind({
				entityKind: "character",
				role: "primary_character",
				hasAvatar: true,
				hasCover: true,
			}),
		).toBe("cover");
		expect(
			subjectAssociationMediaKind({
				entityKind: "person",
				role: "about",
				hasAvatar: true,
				hasCover: true,
			}),
		).toBe("cover");
	});

	it("keeps the cover slot instead of using the disabled avatar fallback", () => {
		expect(
			subjectAssociationMediaKind({
				entityKind: "character",
				role: "featured_character",
				hasAvatar: true,
				hasCover: false,
			}),
		).toBe("cover");
		expect(
			subjectAssociationMediaKind({
				entityKind: "organization",
				role: "related_subject",
				hasAvatar: false,
				hasCover: false,
			}),
		).toBe("cover");
	});
});
