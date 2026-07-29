import { describe, expect, it } from "vitest";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import { generateBootstrapPassword, parseBootstrapCredentialMode } from "./credentials";
import {
	assertBootstrapManifest,
	BootstrapEpochUnixMilliseconds,
	BootstrapPlatformAccessManifest,
	BootstrapProfileManifest,
	BootstrapRealmManifest,
	BootstrapPlatformAdministratorProfile,
	BootstrapUnitIds,
	OfficialProfileManifest,
	OfficialRealmManifest,
	OfficialZoneManifest,
	RezicsRuleRealmManifest,
	RezicsScoreRealmManifest,
	ReservedBootstrapUuidv7s,
	SlugNamespaceManifest,
	uuidv7UnixMilliseconds,
} from "./manifest";

describe("database bootstrap manifest", () => {
	it("uses unique, chronologically coherent UUIDv7 identifiers", () => {
		expect(() => assertBootstrapManifest()).not.toThrow();
		expect(new Set(ReservedBootstrapUuidv7s).size).toBe(ReservedBootstrapUuidv7s.length);
		for (const id of ReservedBootstrapUuidv7s) {
			expect(id[14]).toBe("7");
			expect(["8", "9", "a", "b"]).toContain(id[19]);
			expect(uuidv7UnixMilliseconds(id)).toBe(BootstrapEpochUnixMilliseconds);
		}
	});

	it("models top-level namespaces directly under the virtual null root", () => {
		expect(SlugNamespaceManifest.map((value) => value.slug)).toEqual([
			"users",
			"realms",
			"tags",
			"zones",
			"entities",
		]);
	});

	it("models multiple official identities as ordinary credential-backed Profiles", () => {
		expect(OfficialProfileManifest.map((value) => value.key)).toEqual([
			"community",
			"editorial",
			"moderation",
		]);
		for (const value of OfficialProfileManifest) {
			expect(value).toHaveProperty("authUserId");
			expect(value).toHaveProperty("profileId");
			expect(value).not.toHaveProperty("official");
			expect(value).not.toHaveProperty("password");
			expect(value.localizations.map((localization) => localization.language)).toEqual([
				"zh",
				"en",
			]);
		}
	});

	it("reserves one stable Favorites Collection identity for every bootstrap Profile", () => {
		expect(BootstrapProfileManifest.map((profile) => profile.favoritesCollectionId)).toEqual([
			"019b76da-a800-7250-8000-000000000001",
			"019b76da-a800-7250-8000-000000000002",
			"019b76da-a800-7250-8000-000000000003",
			"019b76da-a800-7250-8000-000000000004",
		]);
		for (const profile of BootstrapProfileManifest) {
			expect(BootstrapUnitIds).toContain(profile.favoritesCollectionId);
		}
	});

	it("keeps the bootstrap administrator distinct and grants the complete platform policy", () => {
		expect(BootstrapProfileManifest).toHaveLength(OfficialProfileManifest.length + 1);
		expect(OfficialProfileManifest).not.toContain(BootstrapPlatformAdministratorProfile);
		expect(BootstrapPlatformAdministratorProfile.email).toBe("admin@rezics.com");
		expect(BootstrapPlatformAdministratorProfile.capabilities).toEqual(
			expect.arrayContaining([
				"platform.access.manage",
				"platform.audit.read",
				"platform.development_preview.access",
				"unit.edit",
			]),
		);
		expect(new Set(BootstrapPlatformAdministratorProfile.capabilities).size).toBe(
			BootstrapPlatformAdministratorProfile.capabilities.length,
		);
		expect(BootstrapPlatformAccessManifest).toContainEqual(
			expect.objectContaining({ capabilities: ["platform.moderate"] }),
		);
	});

	it("bootstraps the five official catalog experiences as renderable Zones", () => {
		expect(OfficialZoneManifest.map((value) => value.slug)).toEqual([
			"book",
			"media",
			"software",
			"realm",
			"zone",
		]);
		expect(
			OfficialZoneManifest.map((value) =>
				value.localizations.map(({ language, title }) => ({ language, title })),
			),
		).toEqual([
			[
				{ language: "zh", title: "書籍" },
				{ language: "en", title: "Books" },
			],
			[
				{ language: "zh", title: "媒體" },
				{ language: "en", title: "Media" },
			],
			[
				{ language: "zh", title: "軟體" },
				{ language: "en", title: "Software" },
			],
			[
				{ language: "zh", title: "領域" },
				{ language: "en", title: "Realms" },
			],
			[
				{ language: "zh", title: "專區" },
				{ language: "en", title: "Zones" },
			],
		]);
		expect(OfficialZoneManifest.map((value) => value.boundaryDocument)).toEqual([
			expect.objectContaining({
				categories: ["units", "posts", "reviews", "collections"],
				filter: {
					any: [
						{ kind: { in: ["book"] } },
						{ post: { is: { subject: { is: { kind: { in: ["book"] } } } } } },
						{
							collection: {
								is: { items: { some: { kind: { in: ["book"] } } } },
							},
						},
					],
				},
			}),
			expect.objectContaining({
				categories: ["units", "posts", "reviews", "collections"],
				filter: expect.objectContaining({
					any: expect.arrayContaining([{ kind: { in: ["media"] } }]),
				}),
			}),
			expect.objectContaining({
				categories: ["units", "posts", "reviews", "collections"],
				filter: expect.objectContaining({
					any: expect.arrayContaining([{ kind: { in: ["software"] } }]),
				}),
			}),
			expect.objectContaining({
				categories: ["realms"],
			}),
			expect.objectContaining({
				categories: ["units"],
				filter: { kind: { in: ["zone"] } },
			}),
		]);
		for (const value of OfficialZoneManifest) {
			expect(value).not.toHaveProperty("official");
			expect(value.homePage.document.blocks).toEqual([
				expect.objectContaining({
					_type: "feed",
					feature: { kind: "zone" },
					presentation: expect.objectContaining({ pagination: "load-more" }),
				}),
			]);
			expect(value.mainDockDocument.blocks).toEqual([
				expect.objectContaining({
					_type: "menu",
					navigationId: value.navigation.id,
				}),
			]);
		}
		expect(OfficialZoneManifest.map((value) => value.avatar)).toEqual(
			["book-open", "clapperboard", "code", "people-group", "compass"].map((name) => ({
				type: "icon",
				icon: { provider: "font-awesome", prefix: "fas", name },
			})),
		);
		expect(OfficialZoneManifest.map((value) => value.searchTemplate)).toEqual([
			"book",
			"media",
			"software",
			"realm",
			"zone",
		]);
	});

	it("uses the REZICS title without making the official Realm a Zone default", () => {
		expect(OfficialRealmManifest.localizations).toEqual([
			expect.objectContaining({ language: "zh", title: verbatimTerms.rezics.value }),
			expect.objectContaining({ language: "en", title: verbatimTerms.rezics.value }),
		]);
		expect(OfficialZoneManifest.map((value) => value.id)).not.toContain(
			OfficialRealmManifest.id,
		);
	});

	it("bootstraps REZICS Score as a distinct fixed-identity Realm", () => {
		expect(BootstrapRealmManifest).toEqual([
			OfficialRealmManifest,
			RezicsScoreRealmManifest,
			RezicsRuleRealmManifest,
		]);
		expect(RezicsScoreRealmManifest.id).toBe("019b76da-a800-7300-8000-000000000002");
		expect(RezicsScoreRealmManifest.slug).toBe("score");
		expect(RezicsScoreRealmManifest.localizations).toEqual([
			expect.objectContaining({ language: "zh", title: "REZICS 評分" }),
			expect.objectContaining({ language: "en", title: "REZICS Score" }),
		]);
		expect(RezicsScoreRealmManifest.id).not.toBe(OfficialRealmManifest.id);
	});

	it("bootstraps REZICS Rule as a non-contribution global rule source", () => {
		expect(RezicsRuleRealmManifest.id).toBe("019b76da-a800-7300-8000-000000000003");
		expect(RezicsRuleRealmManifest.slug).toBe("rule");
		expect(RezicsRuleRealmManifest.authenticatedContributions).toBe(false);
		expect(RezicsRuleRealmManifest.localizations).toEqual([
			expect.objectContaining({ language: "zh", title: "REZICS Rule" }),
			expect.objectContaining({ language: "en", title: "REZICS Rule" }),
		]);
		expect(RezicsRuleRealmManifest.rules.items).toHaveLength(5);
		expect(RezicsRuleRealmManifest.rules.items.at(-1)?.localizations).toEqual([
			expect.objectContaining({ language: "zh", title: "智慧財產權侵害" }),
			expect.objectContaining({
				language: "en",
				title: "Intellectual property infringement",
			}),
		]);
		expect(
			RezicsRuleRealmManifest.access.find(
				(value) => value.profileId === BootstrapPlatformAccessManifest[1].profileId,
			)?.permissions,
		).not.toContain("realm.units.moderate");
	});

	it("generates high-entropy URL-safe passwords without persisting them in the manifest", () => {
		const passwords = Array.from({ length: 32 }, generateBootstrapPassword);
		expect(new Set(passwords).size).toBe(passwords.length);
		for (const password of passwords) {
			expect(password).toMatch(/^[A-Za-z0-9_-]{47}$/);
			expect(password).toMatch(/[A-Z]/);
			expect(password).toMatch(/[a-z]/);
			expect(password).toMatch(/[0-9]/);
			expect(password).toMatch(/[_-]/);
		}
	});

	it("keeps credential overwrite separate from the fill-only default", () => {
		expect(parseBootstrapCredentialMode([])).toBe("fill");
		expect(parseBootstrapCredentialMode(["--overwrite-credentials", "--yes"])).toBe(
			"overwrite",
		);
		expect(parseBootstrapCredentialMode(["--yes", "--overwrite-credentials"])).toBe(
			"overwrite",
		);
		expect(() => parseBootstrapCredentialMode(["--overwrite-credentials"])).toThrow(
			/without --yes/,
		);
		expect(() => parseBootstrapCredentialMode(["--yes"])).toThrow(/Usage:/);
		expect(() => parseBootstrapCredentialMode(["--unknown"])).toThrow(/Usage:/);
	});
});
