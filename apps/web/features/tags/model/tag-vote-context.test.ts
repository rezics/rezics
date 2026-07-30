import { describe, expect, it } from "vitest";

import type {
	RealmTagGroupPresentation,
	RealmTagVoteContextPresentation,
} from "./tag-presentation";
import {
	GlobalTagVoteContext,
	resolveTagVoteContext,
	visibleTagDetailContexts,
} from "./tag-vote-context";

const realms = [
	{
		realmId: "realm-a",
		language: "en",
		title: "A",
		summary: null,
		avatar: null,
	},
] as const satisfies readonly RealmTagVoteContextPresentation[];

const groups = [
	{
		realmId: "realm-a",
		language: "en",
		title: "A",
		summary: null,
		canVote: true,
		tags: [],
	},
	{
		realmId: "realm-b",
		language: "en",
		title: "B",
		summary: null,
		canVote: false,
		tags: [],
	},
] satisfies readonly RealmTagGroupPresentation[];

describe("Tag vote context", () => {
	it("falls back to Global when a requested Realm is no longer voteable", () => {
		expect(resolveTagVoteContext({ kind: "realm", realmId: "realm-missing" }, realms)).toBe(
			GlobalTagVoteContext,
		);
	});

	it("removes only the active context from the lower detail section", () => {
		expect(visibleTagDetailContexts(GlobalTagVoteContext, groups)).toEqual({
			showGlobal: false,
			realmGroups: groups,
		});
		expect(visibleTagDetailContexts({ kind: "realm", realm: realms[0] }, groups)).toEqual({
			showGlobal: true,
			realmGroups: [groups[1]],
		});
	});
});
