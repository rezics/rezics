import { describe, expect, it } from "vitest";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import { generateBootstrapPassword, parseBootstrapCredentialMode } from "./credentials";
import {
	assertBootstrapManifest,
	BootstrapEpochUnixMilliseconds,
	OfficialProfileManifest,
	OfficialRealmManifest,
	OfficialZoneManifest,
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

	it("bootstraps the official libraries and Popular as ordinary Zones", () => {
		expect(OfficialZoneManifest.map((value) => value.slug)).toEqual([
			"book",
			"media",
			"software",
			"realms",
			"zones",
			"popular",
		]);
		expect(
			OfficialZoneManifest.map((value) =>
				value.localizations.map(({ language, title }) => ({ language, title })),
			),
		).toEqual([
			[
				{ language: "zh", title: "書庫" },
				{ language: "en", title: "Book Library" },
			],
			[
				{ language: "zh", title: "媒體庫" },
				{ language: "en", title: "Media Library" },
			],
			[
				{ language: "zh", title: "軟體庫" },
				{ language: "en", title: "Software Library" },
			],
			[
				{ language: "zh", title: "領域庫" },
				{ language: "en", title: "Realm Library" },
			],
			[
				{ language: "zh", title: "專區庫" },
				{ language: "en", title: "Zone Library" },
			],
			[
				{ language: "zh", title: "熱門" },
				{ language: "en", title: "Popular" },
			],
		]);
		expect(OfficialZoneManifest.slice(0, 3).map((value) => value.boundaryDocument)).toEqual([
			expect.objectContaining({
				categories: ["units"],
				filters: [{ field: "type", operator: "equals", value: "book" }],
			}),
			expect.objectContaining({
				categories: ["units"],
				filters: [{ field: "type", operator: "equals", value: "media" }],
			}),
			expect.objectContaining({
				categories: ["units"],
				filters: [{ field: "type", operator: "equals", value: "software" }],
			}),
		]);
		expect(OfficialZoneManifest.slice(3).map((value) => value.boundaryDocument)).toEqual([
			expect.objectContaining({ categories: ["realms"], filters: [] }),
			expect.objectContaining({
				categories: ["units"],
				filters: [{ field: "type", operator: "equals", value: "zone" }],
			}),
			expect.objectContaining({
				categories: [
					"units",
					"users",
					"entity",
					"tags",
					"posts",
					"realms",
					"collections",
					"reviews",
					"polls",
				],
				filters: [],
			}),
		]);
		for (const value of OfficialZoneManifest) {
			expect(value).not.toHaveProperty("official");
		}
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
