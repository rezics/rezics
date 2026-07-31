import { describe, expect, it } from "vitest";

import {
	getRealmContentComposerModes,
	RealmContentComposerDefaultMode,
} from "./realm-content-composer";

describe("Realm content composer modes", () => {
	it("starts with Post and keeps Wiki second", () => {
		expect(RealmContentComposerDefaultMode).toBe("post");
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: false,
				canManageTagContexts: true,
			}),
		).toEqual(["post", "wiki"]);
	});

	it("adds Tag Context only when voting and relationship management are both enabled", () => {
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: true,
				canManageTagContexts: true,
			}),
		).toEqual(["post", "wiki", "tag-context"]);
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: true,
				canManageTagContexts: false,
			}),
		).toEqual(["post", "wiki"]);
	});
});
