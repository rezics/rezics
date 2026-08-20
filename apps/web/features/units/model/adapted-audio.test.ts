import { describe, expect, it } from "vitest";

import { adaptedAudioUnitIdsChanged } from "./adapted-audio";

describe("adapted Audio relation draft", () => {
	it("compares the bounded relation as a set before deciding whether to PATCH", () => {
		expect(adaptedAudioUnitIdsChanged(["audio-b", "audio-a"], ["audio-a", "audio-b"])).toBe(false);
		expect(adaptedAudioUnitIdsChanged(["audio-a"], [])).toBe(true);
		expect(adaptedAudioUnitIdsChanged([], ["audio-a"])).toBe(true);
	});
});
