import { describe, expect, it } from "vitest";

import { estimateMediaItemProgresses } from "./media-progress-estimate";

const node = (
	id: string,
	input: {
		readonly contentKind?: "media" | "video" | "audio" | "label";
		readonly durationSeconds?: number | null;
		readonly parentId?: string | null;
		readonly position: string;
	},
) => ({
	id,
	parentId: input.parentId ?? null,
	contentUnitId: id,
	contentKind: input.contentKind ?? ("video" as const),
	language: "en" as const,
	title: id,
	position: input.position,
	durationSeconds: input.durationSeconds ?? null,
});

describe("media progress estimation", () => {
	it("weights complete durations and excludes structural labels", () => {
		const nodes = [
			node("label", { contentKind: "label", position: "a0" }),
			node("one", {
				durationSeconds: 100,
				parentId: "label",
				position: "a0",
			}),
			node("two", {
				contentKind: "audio",
				durationSeconds: 300,
				parentId: "label",
				position: "a1",
			}),
		];

		expect(estimateMediaItemProgresses(nodes)).toEqual([
			{ id: "one", method: "duration", percentage: 25 },
			{ id: "two", method: "duration", percentage: 100 },
		]);
	});

	it("falls back to item order when any duration is unavailable", () => {
		const nodes = [
			node("one", { durationSeconds: 100, position: "a0" }),
			node("two", { contentKind: "audio", position: "a1" }),
			node("three", { durationSeconds: 300, position: "a2" }),
		];

		expect(estimateMediaItemProgresses(nodes)).toEqual([
			{ id: "one", method: "item-order", percentage: 33 },
			{ id: "two", method: "item-order", percentage: 67 },
			{ id: "three", method: "item-order", percentage: 100 },
		]);
	});

	it("excludes referenced Media occurrences from progress", () => {
		const nodes = [
			node("referenced-media", {
				contentKind: "media",
				durationSeconds: 600,
				position: "a0",
			}),
			node("video", { durationSeconds: 100, position: "a1" }),
		];

		expect(estimateMediaItemProgresses(nodes)).toEqual([
			{ id: "video", method: "duration", percentage: 100 },
		]);
	});
});
