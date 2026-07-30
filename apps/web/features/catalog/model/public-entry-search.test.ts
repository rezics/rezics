import { describe, expect, it } from "vitest";

import {
	entityPublicEntrySearchSubject,
	isPublicEntrySearchConfirmed,
	parsePublicEntrySearchSubject,
	publicEntryCreationHref,
	publicEntrySearchConfirmation,
	publicEntrySearchHref,
	publicEntrySearchResultHref,
	TagPublicEntrySearchSubject,
	unitPublicEntrySearchSubject,
} from "./public-entry-search";

describe("catalog public-entry search subjects", () => {
	it("keeps each public-entry type aligned with its exact search domain", () => {
		expect(unitPublicEntrySearchSubject("book")).toEqual({
			filterKind: "book",
			kind: "book",
			searchIndex: "units",
			section: "book",
		});
		expect(entityPublicEntrySearchSubject("organization")).toEqual({
			filterKind: "organization",
			kind: "organization",
			searchIndex: "entity",
			section: "entity",
		});
		expect(TagPublicEntrySearchSubject).toEqual({
			kind: "tag",
			searchIndex: "tags",
			section: "tag",
		});
	});

	it("rejects a route whose section and kind do not describe the same subject", () => {
		expect(parsePublicEntrySearchSubject("book", "software")).toBeUndefined();
		expect(parsePublicEntrySearchSubject("entity", "entity")).toBeUndefined();
		expect(parsePublicEntrySearchSubject("tag", undefined)).toBeUndefined();
		expect(parsePublicEntrySearchSubject("entity", "character")).toEqual(
			entityPublicEntrySearchSubject("character"),
		);
	});
});

describe("public-entry search routes and confirmation", () => {
	it("carries the exact subject and current title into Studio search", () => {
		expect(publicEntrySearchHref(unitPublicEntrySearchSubject("media"), "  The Bear  ")).toBe(
			"/create/media/search?kind=media&q=The+Bear",
		);
		expect(publicEntrySearchHref(entityPublicEntrySearchSubject("person"), "")).toBe(
			"/create/entity/search?kind=person",
		);
	});

	it("binds confirmation to the normalized query and exact subject", () => {
		const subject = unitPublicEntrySearchSubject("book");
		const confirmation = publicEntrySearchConfirmation(subject, "  Dune   Messiah ");

		expect(isPublicEntrySearchConfirmed(subject, "dune messiah", confirmation)).toBe(true);
		expect(isPublicEntrySearchConfirmed(subject, "Dune", confirmation)).toBe(false);
		expect(
			isPublicEntrySearchConfirmed(
				unitPublicEntrySearchSubject("media"),
				"Dune Messiah",
				confirmation,
			),
		).toBe(false);
		expect(isPublicEntrySearchConfirmed(subject, "", confirmation)).toBe(false);
	});

	it("returns to the correct creator only after a completed search", () => {
		const href = publicEntryCreationHref(
			entityPublicEntrySearchSubject("organization"),
			"OpenAI",
		);
		const url = new URL(href, "https://rezics.example");

		expect(url.pathname).toBe("/entities/new");
		expect(url.searchParams.get("catalogMode")).toBe("public_entry");
		expect(url.searchParams.get("kind")).toBe("organization");
		expect(url.searchParams.get("title")).toBe("OpenAI");
		expect(
			isPublicEntrySearchConfirmed(
				entityPublicEntrySearchSubject("organization"),
				"OpenAI",
				url.searchParams.get("publicEntrySearch"),
			),
		).toBe(true);
	});

	it("links search hits to the subject's public detail route", () => {
		expect(
			publicEntrySearchResultHref(unitPublicEntrySearchSubject("software"), "unit-id"),
		).toBe("/units/software/unit-id");
		expect(publicEntrySearchResultHref(TagPublicEntrySearchSubject, "tag-id")).toBe(
			"/tags/tag-id",
		);
	});
});
