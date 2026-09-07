import { describe, expect, it } from "vitest";
import {
	programStructureRevisionValue,
	publishingStructureRevisionValue,
} from "./structure-history";
const id = "01900000-0000-7000-8000-000000000001";
describe("native structure revision decoding", () => {
	it("preserves fractional episode numbers and unknown date precision", () => {
		expect(
			programStructureRevisionValue("program_episode", {
				id,
				program_id: null,
				season_id: null,
				type_revision_id: null,
				sort_number: "1.5",
				episode_number: "2.25",
				disc_number: 0,
				duration_text: "24m",
				length_milliseconds: 1440000,
				date_year: 2020,
				date_month: null,
				date_day: null,
				date_text: "2020",
			}),
		).toMatchObject({
			shape: "episode",
			fields: {
				sortNumber: 1.5,
				episodeNumber: 2.25,
				date: { year: 2020, month: null, day: null },
				durationText: "24m",
			},
		});
	});
	it("keeps declared main and total episode counts independent", () => {
		expect(
			programStructureRevisionValue("program_work", {
				id,
				type_revision_id: null,
				declared_main_episode_count: 26,
				declared_total_episode_count: 31,
			}),
		).toMatchObject({ fields: { declaredMainEpisodeCount: 26, declaredTotalEpisodeCount: 31 } });
	});
	it("restores native publications without inventing a Work or erasing source pagination text", () => {
		expect(
			publishingStructureRevisionValue("publishing_publication", {
				id,
				page_count: 188,
				pagination_text: "xii, 188",
			}),
		).toEqual({ shape: "publication", fields: { pageCount: 188, paginationText: "xii, 188" } });
		expect(() =>
			publishingStructureRevisionValue("publishing_publication", {
				id,
				page_count: -1,
				pagination_text: null,
			}),
		).toThrow();
		expect(() => programStructureRevisionValue("publishing_publication", { id })).toThrow();
	});
});
