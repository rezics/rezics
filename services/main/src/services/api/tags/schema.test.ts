import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateTagStructureBody,
	RealmTagSubscriptionResponse,
	RealmUnitTagVoteListQuery,
	UnitTagLandscapeQuery,
	UnitTagLandscapeResponse,
	UpdateTagStructureBody,
	UpsertRealmTagSubscriptionBody,
} from "./schema";

describe("Tag API schemas", () => {
	it("bounds personalized landscape sizes", () => {
		expect(
			Value.Check(UnitTagLandscapeQuery, {
				globalLimit: 100,
				structureLimit: 50,
				sourceLimit: 30,
				perRealmLimit: 50,
			}),
		).toBe(true);
		expect(Value.Check(UnitTagLandscapeQuery, { sourceLimit: 31 })).toBe(false);
		expect(
			Value.Check(RealmUnitTagVoteListQuery, {
				localizationLanguages: ["en", "zh"],
				limit: 50,
			}),
		).toBe(true);
		expect(Value.Check(RealmUnitTagVoteListQuery, { limit: 51 })).toBe(false);
	});

	it("requires a community-immutable ordered path of distinct Tag ids", () => {
		const first = "018f2f3a-7ac0-7000-8000-000000000001";
		const second = "018f2f3a-7ac0-7000-8000-000000000002";
		expect(Value.Check(CreateTagStructureBody, { memberTagIds: [first, second] })).toBe(true);
		expect(Value.Check(CreateTagStructureBody, { memberTagIds: [first] })).toBe(false);
		expect(Value.Check(CreateTagStructureBody, { memberTagIds: [first, first] })).toBe(false);
		expect(
			Value.Check(UpdateTagStructureBody, {
				memberTagIds: [second, first],
				updatedAt: "2026-07-23T12:00:00.000Z",
				reason: "Correct the hierarchy order.",
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateTagStructureBody, {
				memberTagIds: [second, first],
				updatedAt: "2026-07-23T12:00:00.000Z",
				reason: "",
			}),
		).toBe(false);
	});

	it("accepts an omitted position or a valid fractional position", () => {
		expect(Value.Check(UpsertRealmTagSubscriptionBody, {})).toBe(true);
		expect(Value.Check(UpsertRealmTagSubscriptionBody, { position: "a0" })).toBe(true);
		expect(Value.Check(UpsertRealmTagSubscriptionBody, { position: "" })).toBe(false);
	});

	it("requires Realm avatars and rejects empty Unit Tag sources", () => {
		const subscription = {
			realmId: "018f2f3a-7ac0-7000-8000-000000000001",
			language: "en",
			title: "Readers",
			summary: null,
			avatar: { type: "emoji", emoji: "📚" },
			position: "a0",
			createdAt: "2026-07-30T00:00:00.000Z",
			updatedAt: "2026-07-30T00:00:00.000Z",
		};
		expect(Value.Check(RealmTagSubscriptionResponse, subscription)).toBe(true);
		expect(
			Value.Check(RealmTagSubscriptionResponse, { ...subscription, avatar: undefined }),
		).toBe(false);
		expect(
			Value.Check(UnitTagLandscapeResponse, {
				structures: [],
				global: [],
				realms: [{ ...subscription, canVote: false, votedTags: [] }],
				voteRealms: [],
			}),
		).toBe(false);
	});
});
