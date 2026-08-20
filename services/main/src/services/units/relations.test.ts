import { describe, expect, it } from "vitest";

import { UnitRelationInvalid } from "./errors";
import {
	adaptedAudioRelationStates,
	normalizeAdaptedAudioUnitIds,
	relationStateMatchesRegistry,
} from "./relations";

const videoId = "019b76da-a800-7300-8000-000000000001";
const firstAudioId = "019b76da-a800-7300-8000-000000000002";
const secondAudioId = "019b76da-a800-7300-8000-000000000003";

describe("Unit relations", () => {
	it("normalizes an unordered adapted Audio set into deterministic relation states", () => {
		const ids = normalizeAdaptedAudioUnitIds([secondAudioId, firstAudioId]);
		expect(ids).toEqual([firstAudioId, secondAudioId]);
		expect(adaptedAudioRelationStates(videoId, ids)).toEqual([
			{
				sourceUnitId: videoId,
				sourceUnitKind: "video",
				kind: "adapted_audio",
				targetUnitId: firstAudioId,
				targetUnitKind: "audio",
			},
			{
				sourceUnitId: videoId,
				sourceUnitKind: "video",
				kind: "adapted_audio",
				targetUnitId: secondAudioId,
				targetUnitKind: "audio",
			},
		]);
	});

	it("treats null as a clear operation and rejects duplicate IDs", () => {
		expect(normalizeAdaptedAudioUnitIds(null)).toEqual([]);
		expect(() => normalizeAdaptedAudioUnitIds([firstAudioId, firstAudioId])).toThrow(
			UnitRelationInvalid,
		);
		expect(() => normalizeAdaptedAudioUnitIds([firstAudioId, firstAudioId.toUpperCase()])).toThrow(
			UnitRelationInvalid,
		);
	});

	it("proves relation signatures without widening persisted Unit kinds", () => {
		const [state] = adaptedAudioRelationStates(videoId, [firstAudioId]);
		expect(state && relationStateMatchesRegistry(state)).toBe(true);
		expect(
			relationStateMatchesRegistry({
				sourceUnitId: videoId,
				sourceUnitKind: "audio",
				kind: "adapted_audio",
				targetUnitId: firstAudioId,
				targetUnitKind: "video",
			}),
		).toBe(false);
	});
});
