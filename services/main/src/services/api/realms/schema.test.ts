import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import {
	AcknowledgeRealmRulesBody,
	CreateRealmPinBody,
	CreateRealmTagContextBody,
	CreateRealmWikiBody,
	ListRealmMembersQuery,
	ListRealmUnitsQuery,
	ModerateRealmUnitBody,
	MoveRealmPinsBody,
	RealmPinsQuery,
	RealmRuleRevisionParams,
	RealmRulesQuery,
	RealmUnitListResponse,
	RealmUnitModerationActionResponse,
	RealmUnitModerationQuery,
	RealmUnitModerationResponse,
	UpdateRealmTagVotingBody,
	UpdateRealmBody,
	UpdateRealmRulesBody,
} from "./schema";

describe("Realm member API contract", () => {
	it("accepts an exact Profile identity filter", () => {
		expect(
			Check(ListRealmMembersQuery, {
				profileId: "019f995d-7595-7c99-9183-250790bbfe2f",
				localizationLanguages: ["zh", "en"],
				limit: 1,
			}),
		).toBe(true);
		expect(Check(ListRealmMembersQuery, { profileId: "not-a-profile-id" })).toBe(false);
	});

	it("uses the shared localization fallback query for Realm rules", () => {
		expect(Check(RealmRulesQuery, { localizationLanguages: ["en", "zh"] })).toBe(true);
		expect(Check(RealmRulesQuery, { localizationLanguages: [] })).toBe(false);
	});

	it("requires localization priority when presenting Realm pins", () => {
		expect(Check(RealmPinsQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(Check(RealmPinsQuery, {})).toBe(false);
		expect(Check(RealmPinsQuery, { localizationLanguages: [] })).toBe(false);
	});

	it("keeps fractional Realm pin positions out of the public mutation contract", () => {
		expect(Check(CreateRealmPinBody, { kind: "highlight" })).toBe(true);
		expect(Check(CreateRealmPinBody, { kind: "pinned", position: "a0" })).toBe(false);
	});

	it("accepts semantic Realm pin movement within a destination category", () => {
		expect(
			Check(MoveRealmPinsBody, {
				unitIds: ["019f995d-7595-7c99-9183-250790bbfe2f"],
				destinationKind: "highlight",
				placement: {
					kind: "after",
					unitId: "019f995d-7595-7c99-9183-250790bbfe30",
				},
			}),
		).toBe(true);
		expect(
			Check(MoveRealmPinsBody, {
				unitIds: [
					"019f995d-7595-7c99-9183-250790bbfe2f",
					"019f995d-7595-7c99-9183-250790bbfe2f",
				],
				destinationKind: "highlight",
				placement: { kind: "end" },
			}),
		).toBe(false);
	});

	it.each(["explicit", "implicit_on_follow"] as const)(
		"accepts the %s rule acknowledgement mode",
		(acknowledgementMode) => {
			expect(
				Check(UpdateRealmRulesBody, {
					acknowledgementMode,
					requireOnJoin: true,
					requireOnPost: true,
					rules: [
						{
							language: "en",
							title: "Community rules",
							content: createPortableTextDocument([], "0123456789ab"),
						},
					],
				}),
			).toBe(true);
		},
	);

	it("rejects an undeclared rule acknowledgement mode", () => {
		expect(
			Check(UpdateRealmRulesBody, {
				acknowledgementMode: "silent",
				requireOnJoin: false,
				requireOnPost: false,
				rules: [
					{
						language: "en",
						title: "Community rules",
						content: createPortableTextDocument([], "0123456789ab"),
					},
				],
			}),
		).toBe(false);
	});

	it("rejects the removed update acknowledgement trigger", () => {
		expect(
			Check(UpdateRealmRulesBody, {
				acknowledgementMode: "explicit",
				requireOnJoin: true,
				requireOnPost: true,
				requireOnUpdate: true,
				rules: [
					{
						language: "en",
						title: "Community rules",
						content: createPortableTextDocument([], "0123456789ab"),
					},
				],
			}),
		).toBe(false);
	});

	it("requires a concrete rule revision and acknowledgement language", () => {
		expect(
			Check(RealmRuleRevisionParams, {
				realmId: "019f995d-7595-7c99-9183-250790bbfe2f",
				revisionId: "019f995d-7595-7c99-9183-250790bbfe30",
			}),
		).toBe(true);
		expect(Check(AcknowledgeRealmRulesBody, { language: "zh" })).toBe(true);
		expect(Check(AcknowledgeRealmRulesBody, {})).toBe(false);
	});
});

describe("Realm update API contract", () => {
	it("accepts a join-policy-only partial update", () => {
		expect(Check(UpdateRealmBody, { joinPolicy: "approval" })).toBe(true);
	});

	it("keeps the Realm Tag voting feature flag on its own contract", () => {
		expect(Check(UpdateRealmBody, { realmTagVotingEnabled: true })).toBe(false);
		expect(Check(UpdateRealmTagVotingBody, { enabled: true })).toBe(true);
	});
});

describe("Realm Wiki creation API contract", () => {
	const body = createPortableTextDocument([], "0123456789ab");

	it("defaults Realm-created Wikis and Tag Context Wikis to community editing", () => {
		expect(
			Check(CreateRealmWikiBody, {
				title: "Shared knowledge",
				body,
				language: "en",
			}),
		).toBe(true);
		expect(
			Check(CreateRealmTagContextBody, {
				tagId: "019f995d-7595-7c99-9183-250790bbfe2f",
				title: "Context",
				summary: "Shared context",
				body,
				language: "en",
			}),
		).toBe(true);
		expect(CreateRealmWikiBody.properties.accessMode.default).toBe("community_owned");
		expect(CreateRealmTagContextBody.properties.accessMode.default).toBe("community_owned");
	});
});

describe("Realm moderation API contract", () => {
	it("defaults to current, actively published Realm Unit states", () => {
		expect(ListRealmUnitsQuery.properties.status.default).toBe("current");
		expect(ListRealmUnitsQuery.properties.publicationState.default).toBe("active");
		expect(Check(ListRealmUnitsQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(
			Check(ListRealmUnitsQuery, {
				status: "pending",
				cursor: "eyJ2IjoxfQ",
				limit: 30,
			}),
		).toBe(true);
	});

	it("returns cursor pagination and server-authoritative commands", () => {
		expect(
			Check(RealmUnitListResponse, {
				items: [
					{
						realmId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d",
						unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755e",
						unitKind: "post",
						language: "zh",
						title: "待處理項目",
						status: "pending",
						publicationState: "active",
						postTargetingLocked: false,
						openReportCount: 2,
						allowedCommands: ["approve", "remove", "lock_post_targeting", "note"],
						moderationStatus: "pending",
						createdAt: "2026-07-27T12:00:00.000Z",
						updatedAt: "2026-07-27T12:30:00.000Z",
					},
				],
				nextCursor: "next-page",
			}),
		).toBe(true);
	});

	it("returns one directly addressed moderation target with localized presentation", () => {
		expect(Check(RealmUnitModerationQuery, { localizationLanguages: ["zh", "en"] })).toBe(true);
		expect(
			Check(RealmUnitModerationResponse, {
				realmId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755d",
				unitId: "019fa3ab-72a9-7792-b2e3-43aa8a9c755e",
				unitKind: "post",
				language: "zh",
				title: "待處理項目",
				status: "pending",
				publicationState: "active",
				postTargetingLocked: false,
				openReportCount: 2,
				allowedCommands: ["approve", "remove", "lock_post_targeting", "note"],
				moderationStatus: "pending",
				createdAt: "2026-07-27T12:00:00.000Z",
				updatedAt: "2026-07-27T12:30:00.000Z",
			}),
		).toBe(true);
	});

	it("accepts commands and rejects client-authored resulting state", () => {
		expect(
			Check(ModerateRealmUnitBody, {
				command: "hide",
				reasonCode: "realm_rules",
				idempotencyKey: "moderate-0195c49b",
			}),
		).toBe(true);
		expect(
			Check(ModerateRealmUnitBody, {
				status: "hidden",
				reasonCode: "realm_rules",
			}),
		).toBe(false);
	});

	it("requires a Post-backed annotation for note commands", () => {
		expect(
			Check(ModerateRealmUnitBody, {
				command: "note",
				reasonCode: "administrative",
			}),
		).toBe(false);
		expect(
			Check(ModerateRealmUnitBody, {
				command: "note",
				reasonCode: "administrative",
				annotation: {
					role: "internal_note",
					language: "zh",
					content: createPortableTextDocument([], "0123456789ab"),
				},
			}),
		).toBe(true);
	});

	it("returns the updated target snapshot after moderation", () => {
		expect(
			Check(RealmUnitModerationActionResponse, {
				id: "019fa3ab-72a9-7792-b2e3-43aa8a9c755f",
				caseId: "019fa3ab-72a9-7792-b2e3-43aa8a9c7560",
				actorProfileId: "019fa3ab-72a9-7792-b2e3-43aa8a9c7561",
				kind: "approve",
				previousState: "pending",
				resultingState: "visible",
				previousPostTargetingLocked: null,
				contentLicenseId: null,
				previousContentLicenseStatus: null,
				resultingContentLicenseStatus: null,
				resultingStatus: "visible",
				resultingPostTargetingLocked: null,
				reasonCode: "realm_rules",
				reversesActionId: null,
				notes: [],
				createdAt: "2026-07-27T12:30:00.000Z",
				target: {
					status: "visible",
					publicationState: "active",
					postTargetingLocked: false,
					openReportCount: 0,
					allowedCommands: ["hide", "remove", "lock_post_targeting", "note"],
					updatedAt: "2026-07-27T12:30:00.000Z",
				},
			}),
		).toBe(true);
	});
});
