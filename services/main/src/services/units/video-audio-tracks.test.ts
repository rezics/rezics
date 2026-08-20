import { describe, expect, it } from "vitest";

import { VideoAudioTrackInvalid } from "./errors";
import { normalizeAdaptedAudioUnitIds } from "./video-audio-tracks";

const firstAudioId = "019b76da-a800-7300-8000-000000000002";
const secondAudioId = "019b76da-a800-7300-8000-000000000003";

describe("Video Audio tracks", () => {
	it("normalizes an unordered adapted Audio set into deterministic track IDs", () => {
		expect(normalizeAdaptedAudioUnitIds([secondAudioId, firstAudioId])).toEqual([
			firstAudioId,
			secondAudioId,
		]);
	});

	it("treats null as a clear operation and rejects duplicate IDs", () => {
		expect(normalizeAdaptedAudioUnitIds(null)).toEqual([]);
		expect(() => normalizeAdaptedAudioUnitIds([firstAudioId, firstAudioId])).toThrow(
			VideoAudioTrackInvalid,
		);
		expect(() => normalizeAdaptedAudioUnitIds([firstAudioId, firstAudioId.toUpperCase()])).toThrow(
			VideoAudioTrackInvalid,
		);
	});
});
