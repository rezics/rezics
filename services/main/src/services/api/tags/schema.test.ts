import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	CreateTagExpressionBody,
	CreateTagPathBody,
	CreateTagPathSenseBody,
	RealmTagSubscriptionResponse,
	RealmUnitTagVoteListResponse,
	RealmUnitTagVoteListQuery,
	UnitTagLandscapeQuery,
	UnitTagLandscapeParams,
	UnitTagLandscapeResponse,
	UpsertRealmTagSubscriptionBody,
} from "./schema";

describe("Tag API schemas", () => {
	it("accepts Entity Tag landscapes", () => {
		expect(
			Value.Check(UnitTagLandscapeParams, {
				type: "entity",
				unitId: "018f2f3a-7ac0-7000-8000-000000000001",
			}),
		).toBe(true);
	});

	it("bounds personalized landscape sizes", () => {
		expect(
			Value.Check(UnitTagLandscapeQuery, {
				expressionLimit: 100,
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

	it("requires a structural Path of distinct nodes and typed relations", () => {
		const first = "018f2f3a-7ac0-7000-8000-000000000001";
		const second = "018f2f3a-7ac0-7000-8000-000000000002";
		const relation = "018f2f3a-7ac0-7000-8000-000000000003";
		expect(
			Value.Check(CreateTagPathBody, {
				memberNodeIds: [first, second],
				relationIds: [relation],
			}),
		).toBe(true);
		expect(Value.Check(CreateTagPathBody, { memberNodeIds: [first], relationIds: [] })).toBe(false);
		expect(
			Value.Check(CreateTagPathBody, {
				memberNodeIds: [first, first],
				relationIds: [relation],
			}),
		).toBe(false);
		expect(
			Value.Check(CreateTagPathBody, {
				memberNodeIds: [second, first],
				relationIds: [relation],
				updatedAt: "2026-07-23T12:00:00.000Z",
				reason: "Correct the hierarchy order.",
			}),
		).toBe(false);
	});

	it("requires explicit Expression semantics and Path-Sense bindings", () => {
		const slot = "018f2f3a-7ac0-7000-8000-000000000001";
		const value = "018f2f3a-7ac0-7000-8000-000000000002";
		const expression = "018f2f3a-7ac0-7000-8000-000000000003";
		expect(
			Value.Check(CreateTagExpressionBody, {
				expressionKind: "facet_value",
				canonicalClaimKey: `facet-value:${slot}:${value}`,
				focusTagId: value,
				arguments: [
					{ role: "slot", ordinal: 0, tagId: slot },
					{ role: "value", ordinal: 0, tagId: value },
				],
				labelComponents: [
					{ tagId: slot, semanticRole: "slot", componentKind: "required" },
					{ tagId: value, semanticRole: "value", componentKind: "required" },
				],
				groupKey: { tagId: slot, semanticRole: "slot" },
			}),
		).toBe(true);
		expect(
			Value.Check(CreateTagPathSenseBody, {
				expressionId: expression,
				scope: "global",
				bindings: [
					{ memberOrdinal: 0, argumentRole: "slot", argumentOrdinal: 0 },
					{ memberOrdinal: 1, argumentRole: "value", argumentOrdinal: 0 },
				],
			}),
		).toBe(true);
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
		expect(Value.Check(RealmTagSubscriptionResponse, { ...subscription, avatar: undefined })).toBe(
			false,
		);
		expect(
			Value.Check(UnitTagLandscapeResponse, {
				expressions: [],
				totals: { expressions: 0 },
				realms: [{ ...subscription, canVote: false, votedTags: [] }],
				voteRealms: [],
			}),
		).toBe(false);
	});

	it("requires Realm-voted Tag timestamps in their wire representation", () => {
		const tag = {
			tagId: "018f2f3a-7ac0-7000-8000-000000000001",
			language: "en" as const,
			title: "Fiction",
			summary: null,
			avatar: null,
			createdAt: "2026-07-30T00:00:00.000Z",
			updatedAt: "2026-07-31T00:00:00.000Z",
			realmId: "018f2f3a-7ac0-7000-8000-000000000002",
			contextPostId: "018f2f3a-7ac0-7000-8000-000000000003",
			score: 1,
			voteCount: 1,
			viewerVote: 1 as const,
		} satisfies (typeof RealmUnitTagVoteListResponse.static)["tags"][number];
		const response = {
			realmId: tag.realmId,
			tags: [tag],
		} satisfies typeof RealmUnitTagVoteListResponse.static;

		expect(Value.Check(RealmUnitTagVoteListResponse, response)).toBe(true);
		for (const timestamp of ["createdAt", "updatedAt"] as const)
			expect(
				Value.Check(RealmUnitTagVoteListResponse, {
					...response,
					tags: [{ ...tag, [timestamp]: new Date(tag[timestamp]) }],
				}),
			).toBe(false);
	});
});
