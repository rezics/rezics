import { isPortableText } from "@rezics/portable-text";
import { describe, expect, it } from "vitest";

import {
	assertLocalDatabaseUrl,
	chunks,
	collectUnique,
	createSeedData,
	createSeedEnforcementPlan,
	dateOnly,
	latestDate,
	position,
	selectSeedRealmModerationTarget,
	SeedLanguages,
} from "./seed-data";

describe("seed data", () => {
	it("is deterministic for a fixed reference time", () => {
		const referenceTime = new Date("2026-07-15T12:00:00.000Z");
		const createSample = () => {
			const data = createSeedData(referenceTime);
			return Array.from({ length: 20 }, (_, index) => {
				const language = data.languages(index)[0];
				if (!language) throw new Error("A seed localization must have a primary language");
				return {
					languages: data.languages(index),
					name: data.name(language),
					title: data.title(language),
					body: data.portableText(language),
					state: data.unitState(index),
				};
			});
		};

		expect(createSample()).toEqual(createSample());
	});

	it("keeps the declared language and localization quotas", () => {
		const data = createSeedData(new Date("2026-07-15T12:00:00.000Z"));
		const plans = Array.from({ length: 20 }, (_, index) => data.languages(index));
		const primary = plans.map(([language]) => language);

		expect(primary.filter((language) => language === "zh-hant")).toHaveLength(8);
		expect(primary.filter((language) => language === "en")).toHaveLength(7);
		expect(primary.filter((language) => language === "ja")).toHaveLength(5);
		expect(plans.filter((languages) => languages.length === 1)).toHaveLength(11);
		expect(plans.filter((languages) => languages.length === 2)).toHaveLength(7);
		expect(plans.filter((languages) => languages.length === 3)).toHaveLength(2);
		for (const languages of plans) {
			expect(new Set(languages).size).toBe(languages.length);
			expect(languages.every((language) => SeedLanguages.includes(language))).toBe(true);
		}
	});

	it("builds valid Portable Text and bounded states", () => {
		const data = createSeedData(new Date("2026-07-15T12:00:00.000Z"));
		for (const language of SeedLanguages) {
			expect(isPortableText(data.portableText(language, 3))).toBe(true);
		}
		const states = Array.from({ length: 100 }, (_, index) => data.unitState(index));
		expect(states.filter(({ status }) => status === "published")).toHaveLength(85);
		expect(states.filter(({ status }) => status === "draft")).toHaveLength(8);
		expect(states.filter(({ status }) => status === "archived")).toHaveLength(7);
		expect(
			states.every((state) => (state.status === "draft") === (state.publishedAt === null)),
		).toBe(true);
	});

	it("chunks and deduplicates without hiding impossible requests", () => {
		expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		let value = 0;
		expect(collectUnique(3, () => value++, String)).toEqual([0, 1, 2]);
		expect(() => collectUnique(2, () => 1, String)).toThrow(/Could only create/);
		expect(position(12)).toBe("00000012");
		expect(dateOnly(new Date("2026-07-15T12:00:00.000Z"))).toBe("2026-07-15");
	});

	it("keeps dependent timestamps at or after every lower bound", () => {
		const earlier = new Date("2026-07-14T12:00:00.000Z");
		const later = new Date("2026-07-15T12:00:00.000Z");

		expect(latestDate(earlier, later)).toEqual(later);
		expect(latestDate(later, earlier)).toEqual(later);
		expect(() => latestDate(new Date(Number.NaN))).toThrow(/invalid seed dates/);
	});

	it("derives Realm moderation targets from existing relationship rows", () => {
		const targets = {
			members: [{ realmId: "realm-a", profileId: "profile-a" }],
			contents: [{ realmId: "realm-b", unitId: "unit-b" }],
		};

		expect(selectSeedRealmModerationTarget("realm_member", 0, targets)).toEqual({
			authority: "realm",
			realmId: "realm-a",
			targetKind: "realm_member",
			targetId: "profile-a",
		});
		expect(selectSeedRealmModerationTarget("realm_content", 0, targets)).toEqual({
			authority: "realm",
			realmId: "realm-b",
			targetKind: "realm_content",
			targetId: "unit-b",
		});
		expect(() =>
			selectSeedRealmModerationTarget("realm_member", 0, {
				members: [],
				contents: targets.contents,
			}),
		).toThrow(/cycle must not be empty/);
	});

	it("uses one enforcement kind for its decision and account record", () => {
		const startsAt = new Date("2026-07-15T12:00:00.000Z");
		const plan = createSeedEnforcementPlan({
			index: 12,
			profileId: "profile-a",
			caseId: "case-a",
			actorProfileId: "profile-b",
			kind: "suspension",
			startsAt,
			expiresAt: null,
		});

		expect(plan.action.kind).toBe(plan.enforcement.kind);
		expect(plan.action.idempotencyKey).toBe("seed-enforcement-00000012");
		expect(plan.enforcement).toMatchObject({ profileId: "profile-a", startsAt });
	});

	it("accepts only loopback database URLs", () => {
		expect(() => assertLocalDatabaseUrl("postgres://user:pass@localhost/rezics")).not.toThrow();
		expect(() => assertLocalDatabaseUrl("postgres://user:pass@[::1]/rezics")).not.toThrow();
		expect(() => assertLocalDatabaseUrl("postgres://user:pass@db.example.test/rezics")).toThrow(
			/non-local database host/,
		);
	});
});
