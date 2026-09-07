import { describe, expect, test } from "bun:test";
import {
	MusicComponentBatchSchema,
	MusicComponentSchemas,
	musicComponentCompensation,
	musicComponentKey,
} from "./music-structure-contracts";
import { musicBrainzAliasName } from "./musicbrainz-names";

const id = "11111111-1111-4111-8111-111111111111";
const history = "22222222-2222-4222-8222-222222222222";
describe("native music exact structural contracts", () => {
	test("identifier key tokens cannot alias through separator characters", () => {
		const first = musicComponentKey("music_track_identifier", {
			track_id: id,
			namespace: "a/b",
			value: "c",
		});
		const second = musicComponentKey("music_track_identifier", {
			track_id: id,
			namespace: "a",
			value: "b/c",
		});
		expect(first).not.toBe(second);
		expect(first).toBe(`${id}/a~1b/c`);
		expect(
			MusicComponentBatchSchema.safeParse([
				{
					component: "music_track_identifier",
					componentKey: musicComponentKey("music_track_identifier", {
						track_id: id,
						namespace: "x",
						value: "/".repeat(512),
					}),
					action: "remove",
					expectedRevisionId: history,
				},
			]).success,
		).toBe(true);
	});
	test("compensation reverses dependency order and pins each applied child", () => {
		const result = musicComponentCompensation([
			{ component: "music_medium", componentKey: id, beforeRevisionId: null, afterRevisionId: id },
			{
				component: "music_track_occurrence",
				componentKey: id,
				beforeRevisionId: history,
				afterRevisionId: id,
			},
		]);
		expect(result).toEqual([
			{
				component: "music_track_occurrence",
				componentKey: id,
				expectedRevisionId: id,
				action: "restore",
				historyId: history,
			},
			{ component: "music_medium", componentKey: id, expectedRevisionId: id, action: "remove" },
		]);
	});
	test("rejects duplicate heads and unbounded mutation documents", () => {
		const operation = {
			component: "music_medium",
			componentKey: id,
			expectedRevisionId: history,
			action: "remove",
		};
		expect(MusicComponentBatchSchema.safeParse([operation, operation]).success).toBe(false);
		expect(MusicComponentBatchSchema.safeParse(Array(129).fill(operation)).success).toBe(false);
		expect(
			MusicComponentBatchSchema.safeParse([{ ...operation, component: "users" }]).success,
		).toBe(false);
	});
	test("requires the complete native row and rejects arbitrary archive fields", () => {
		const medium = {
			release_id: id,
			id,
			position: 1,
			name: null,
			format_revision_id: null,
			source_track_count: null,
		};
		expect(MusicComponentSchemas.music_medium.parse(medium)).toEqual(medium);
		expect(MusicComponentSchemas.music_medium.safeParse({ ...medium, position: -1 }).success).toBe(
			false,
		);
		expect(MusicComponentSchemas.music_medium.safeParse({ ...medium, source: {} }).success).toBe(
			false,
		);
		expect(MusicComponentSchemas.music_medium.safeParse({ id }).success).toBe(false);
	});
	test("alias sorting, locale, primary preference and lifespan remain on one form", () => {
		expect(
			musicBrainzAliasName({
				name: "別名",
				"sort-name": "べつめい",
				locale: "ja_JP",
				primary: true,
				begin: "2001",
				end: "2002-04",
				ended: true,
			}),
		).toEqual({
			kind: "alias",
			value: "別名",
			sortName: "べつめい",
			languageTag: "ja-JP",
			primaryForLanguage: true,
			begin: { year: 2001, month: null, day: null },
			end: { year: 2002, month: 4, day: null },
			ended: true,
		});
	});
});
