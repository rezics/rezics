import { describe, expect, it } from "vitest";

import { generateBootstrapPassword, parseBootstrapCredentialMode } from "./credentials";
import {
	assertBootstrapManifest,
	BootstrapEpochUnixMilliseconds,
	OfficialProfileManifest,
	ReservedBootstrapUuidv7s,
	RootSlugNamespaceUnitId,
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

	it("orders the root before its top-level slug namespaces", () => {
		expect(SlugNamespaceManifest[0]).toEqual({
			id: RootSlugNamespaceUnitId,
			slug: null,
		});
		expect(SlugNamespaceManifest.slice(1).map((value) => value.slug)).toEqual([
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
		}
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
