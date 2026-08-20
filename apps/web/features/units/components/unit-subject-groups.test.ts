import { describe, expect, it } from "vitest";

import { subjectAssociationMediaKind } from "../model/subject-association-presentation";

describe("subjectAssociationMediaKind", () => {
	it("prefers a cover for character roles and falls back to the avatar", () => {
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
				entityKind: "character",
				role: "featured_character",
				hasAvatar: true,
				hasCover: false,
			}),
		).toBe("avatar");
	});

	it("prefers an avatar for other Entities and falls back to the cover", () => {
		expect(
			subjectAssociationMediaKind({
				entityKind: "person",
				role: "about",
				hasAvatar: true,
				hasCover: true,
			}),
		).toBe("avatar");
		expect(
			subjectAssociationMediaKind({
				entityKind: "organization",
				role: "related_subject",
				hasAvatar: false,
				hasCover: true,
			}),
		).toBe("cover");
	});

	it("uses avatar priority when a Character is linked through a non-character role", () => {
		expect(
			subjectAssociationMediaKind({
				entityKind: "character",
				role: "about",
				hasAvatar: true,
				hasCover: true,
			}),
		).toBe("avatar");
	});
});
