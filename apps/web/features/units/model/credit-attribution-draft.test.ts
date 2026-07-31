import { describe, expect, it } from "vitest";

import {
	createCreditAttributionDraft,
	validateCreditAttributionDrafts,
} from "./credit-attribution-draft";

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
	] as const)("defaults a new %s credit to its first role", (type, role) => {
		expect(createCreditAttributionDraft(type)).toMatchObject({ role });
	});

	it.each([
		["book", "author"],
		["software", "developer"],
		["media", "director"],
	] as const)("accepts the supported %s role %s", (type, role) => {
		expect(
			validateCreditAttributionDrafts(type, [
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

	it("accepts author-only and empty credit lists", () => {
		expect(
			validateCreditAttributionDrafts("book", [
				{
					key: "author",
					entity: { id: "author-id", label: "Author" },
					role: "author",
				},
			]),
		).toMatchObject({
			ok: true,
			creditAttributions: [{ entityId: "author-id", role: "author" }],
		});
		expect(validateCreditAttributionDrafts("book", [])).toMatchObject({
			ok: true,
			creditAttributions: [],
		});
	});

	it("allows one Entity to hold different roles but rejects an exact duplicate", () => {
		expect(
			validateCreditAttributionDrafts("book", [
				publisher,
				{ ...publisher, key: "author", role: "author" },
			]),
		).toMatchObject({ ok: true });
		expect(
			validateCreditAttributionDrafts("book", [
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
			validateCreditAttributionDrafts("media", [
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
