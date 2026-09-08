import { expect, test } from "vitest";
import { MusicBrainzRelationSchema } from "./musicbrainz";
import { correlateMusicBrainzRelations } from "./musicbrainz-relation-plan";

const relation = (begin: string, target = "22222222-2222-4222-8222-222222222222") =>
	MusicBrainzRelationSchema.parse({
		type: "performer",
		"type-id": "11111111-1111-4111-8111-111111111111",
		direction: "forward",
		"target-type": "artist",
		artist: { id: target, name: "Performer" },
		begin,
	});

test("unchanged repeated relationship wins correspondence before an earlier changed occurrence", () => {
	expect(
		correlateMusicBrainzRelations(
			[relation("2000"), relation("2001")],
			[relation("2002"), relation("2000")],
		),
	).toEqual([1, 0]);
});
test("two changed repeated endpoint relations do not guess a native identity", () => {
	expect(() =>
		correlateMusicBrainzRelations(
			[relation("2000"), relation("2001")],
			[relation("2002"), relation("2003")],
		),
	).toThrow("explicit correspondence");
});
test("reorder retains exact relations and another endpoint is new", () => {
	expect(
		correlateMusicBrainzRelations(
			[relation("2000"), relation("2001")],
			[
				relation("2001"),
				relation("2000"),
				relation("2004", "33333333-3333-4333-8333-333333333333"),
			],
		),
	).toEqual([1, 0, null]);
});
