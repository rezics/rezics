import { expect, test } from "vitest";
import { planMusicBrainzRedirects } from "./musicbrainz-redirects";
const old = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
test("source redirect plan keeps exact numeric join and MBID natural keys distinct", () => {
	const [plan] = planMusicBrainzRedirects({ entity: "medium", rows: [{ gid: old, new_id: 19, target: { id: 19, gid: target } }] });
	expect(plan?.sourceKey).toEqual({ source: "musicbrainz", objectType: "medium", externalId: old });
	expect(plan?.targetKey.externalId).toBe(target);
	expect(plan?.targetSourceRowId).toBe(19);
	expect(plan?.evidencePath).toBe("/rows/0");
});
test("rejects wrong joins, self merges, duplicates and batch cycles", () => {
	for (const rows of [
		[{ gid: old, new_id: 19, target: { id: 20, gid: target } }],
		[{ gid: old, new_id: 19, target: { id: 19, gid: old } }],
		[{ gid: old, new_id: 19, target: { id: 19, gid: target } }, { gid: target, new_id: 20, target: { id: 20, gid: old } }],
	]) expect(() => planMusicBrainzRedirects({ entity: "release", rows })).toThrow();
});
