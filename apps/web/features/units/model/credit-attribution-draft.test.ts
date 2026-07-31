import { describe, expect, it } from "vitest";

import { validateCreditAttributionDrafts } from "./credit-attribution-draft";

const publisher = {
	key: "publisher",
	entity: { id: "publisher-id", label: "Publisher" },
	role: "publisher",
} as const;

describe("Unit creation credit attribution drafts", () => {
	it.each([
		["book", "author"],
		["software", "developer"],
		["media", "director"],
	] as const)("accepts the supported %s role %s", (type, role) => {
		expect(
			validateCreditAttributionDrafts(type, "community_owned", [
				{
					key: "credit",
					entity: { id: "entity-id", label: "Entity" },
					role,
				},
			]),
		).toMatchObject({
			ok: true,
			creditAttributions: [{ entityId: "entity-id", role }],
		});
	});

	it("requires an existing publisher role only for profile-owned works", () => {
		expect(
			validateCreditAttributionDrafts("book", "profile_owned", [
				{
					key: "author",
					entity: { id: "author-id", label: "Author" },
					role: "author",
				},
			]),
		).toMatchObject({ ok: false, publisherRequired: true });
		expect(validateCreditAttributionDrafts("book", "profile_owned", [publisher])).toMatchObject(
			{ ok: true, publisherRequired: false },
		);
		expect(validateCreditAttributionDrafts("book", "community_owned", [])).toMatchObject({
			ok: true,
			creditAttributions: [],
		});
	});

	it("allows one Entity to hold different roles but rejects an exact duplicate", () => {
		expect(
			validateCreditAttributionDrafts("book", "community_owned", [
				publisher,
				{ ...publisher, key: "author", role: "author" },
			]),
		).toMatchObject({ ok: true });
		expect(
			validateCreditAttributionDrafts("book", "community_owned", [
				publisher,
				{ ...publisher, key: "duplicate" },
			]),
		).toMatchObject({
			ok: false,
			issues: { duplicate: { duplicate: true } },
		});
	});

	it("reports incomplete rows instead of silently discarding them", () => {
		expect(
			validateCreditAttributionDrafts("media", "community_owned", [
				{ key: "missing-entity", role: "director" },
				{
					key: "missing-role",
					entity: { id: "studio-id", label: "Studio" },
				},
			]),
		).toMatchObject({
			ok: false,
			issues: {
				"missing-entity": { entityRequired: true },
				"missing-role": { roleRequired: true },
			},
		});
	});
});
