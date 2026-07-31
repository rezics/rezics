import { describe, expect, it } from "vitest";

import {
	canCreateRealmTagContext,
	getRealmContentComposerModes,
	RealmContentComposerDefaultMode,
} from "./realm-content-composer";

describe("Realm content composer modes", () => {
	it("starts with Post and keeps Wiki second", () => {
		expect(RealmContentComposerDefaultMode).toBe("post");
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: false,
				canCreateUnits: true,
				canManageTagContexts: true,
			}),
		).toEqual(["post", "wiki"]);
	});

	it("adds Tag Context only when voting and relationship management are both enabled", () => {
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: true,
				canCreateUnits: true,
				canManageTagContexts: true,
			}),
		).toEqual(["post", "wiki", "tag-context"]);
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: true,
				canCreateUnits: true,
				canManageTagContexts: false,
			}),
		).toEqual(["post", "wiki"]);
	});

	it("keeps binding available to Tag Context managers without Unit creation access", () => {
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: true,
				canCreateUnits: false,
				canManageTagContexts: true,
			}),
		).toEqual(["tag-context"]);
		expect(
			getRealmContentComposerModes({
				tagVotingEnabled: false,
				canCreateUnits: false,
				canManageTagContexts: true,
			}),
		).toEqual([]);
	});

	it("requires creation access as well as Tag Context management and voting", () => {
		expect(
			canCreateRealmTagContext({
				tagVotingEnabled: true,
				canCreateUnits: true,
				canManageTagContexts: true,
			}),
		).toBe(true);
		expect(
			canCreateRealmTagContext({
				tagVotingEnabled: true,
				canCreateUnits: false,
				canManageTagContexts: true,
			}),
		).toBe(false);
		expect(
			canCreateRealmTagContext({
				tagVotingEnabled: false,
				canCreateUnits: true,
				canManageTagContexts: true,
			}),
		).toBe(false);
	});
});
