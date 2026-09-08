import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { ensureCatalogDefinition } from "./storage";
import type { CatalogSourceNamePlan } from "./source-name-delta";
import type { CatalogSourceFactDescriptor } from "./source-fact-delta";
import type { CatalogSourceIdentifierDescriptor } from "./source-identifier-delta";
import { openLibraryDate, openLibraryText, type OpenLibraryDocument } from "./openlibrary";
import { openLibraryLanguageTag } from "./openlibrary-language";
import type { CatalogDefinitionConstraints } from "./definition-contracts";

const identityHash = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function openLibraryNames(document: OpenLibraryDocument): CatalogSourceNamePlan[] {
	const names: CatalogSourceNamePlan[] = [];
	const add = (
		path: string,
		value: string,
		kind: string,
		match: "path" | "value",
		languageTag: string | null = null,
		origin: "unknown" | "translation" = "unknown",
	) => {
		if (value)
			names.push({
				path,
				match,
				value: { value, kind, languageTag, origin, translationMethod: "unknown" },
			});
	};
	if (document.kind === "author") {
		add("/name", document.record.name, "primary", "path");
		if (document.record.personal_name && document.record.personal_name !== document.record.name)
			add("/personal_name", document.record.personal_name, "personal", "path");
		document.record.alternate_names?.forEach((value, index) =>
			add(`/alternate_names/${index}`, value, "alternate", "value"),
		);
	} else {
		add("/title", document.record.title, "primary", "path");
		document.record.other_titles?.forEach((value, index) =>
			add(`/other_titles/${index}`, value, "alternate", "value"),
		);
		if (document.kind === "work")
			document.record.translated_titles?.forEach((value, index) =>
				add(
					`/translated_titles/${index}/text`,
					value.text,
					"translated-title",
					"value",
					openLibraryLanguageTag(value.language.key),
					"translation",
				),
			);
	}
	return names;
}
export function openLibraryIdentifiers(
	document: OpenLibraryDocument,
): CatalogSourceIdentifierDescriptor[] {
	const result: CatalogSourceIdentifierDescriptor[] = [
		{ namespace: `openlibrary.${document.kind}`, value: document.record.key, path: "/key" },
	];
	if (document.kind === "edition") {
		const record = document.record;
		for (const [field, namespace] of [
			["isbn_10", "isbn10"],
			["isbn_13", "isbn13"],
			["lccn", "lccn"],
			["oclc_numbers", "oclc"],
		] as const)
			record[field]?.forEach((value, index) => {
				if (value) result.push({ namespace, value, path: `/${field}/${index}` });
			});
		if (record.ocaid)
			result.push({ namespace: "internetarchive.item", value: record.ocaid, path: "/ocaid" });
		for (const [namespace, values] of Object.entries(record.identifiers ?? {}))
			values.forEach((value, index) => {
				if (value)
					result.push({
						namespace: `openlibrary.identifier.${namespace}`,
						value,
						path: `/identifiers/${namespace.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${index}`,
					});
			});
	} else if (document.kind === "author")
		for (const [namespace, value] of Object.entries(document.record.remote_ids ?? {}))
			if (value)
				result.push({
					namespace: `openlibrary.identifier.${namespace}`,
					value,
					path: `/remote_ids/${namespace.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
				});
	return result;
}
export type OpenLibraryContributor = {
	identity: string;
	path: string;
	key: string;
	role: string | null;
	creditedAs: string | null;
	position: number;
};
/** Author-role type tags never masquerade as an asserted contributor role. */
export function openLibraryContributors(document: OpenLibraryDocument): OpenLibraryContributor[] {
	if (document.kind === "author") return [];
	const counts = new Map<string, number>();
	return (document.record.authors ?? []).map((entry, index) => {
		const key =
			document.kind === "work"
				? z.object({ author: z.object({ key: z.string() }) }).parse(entry).author.key
				: z.object({ key: z.string() }).parse(entry).key;
		const credit =
			document.kind === "work"
				? z.object({ role: z.string().optional(), as: z.string().optional() }).parse(entry)
				: {};
		const role = credit.role ?? null,
			creditedAs = credit.as ?? null,
			token = identityHash([key, role, creditedAs]),
			ordinal = counts.get(token) ?? 0;
		counts.set(token, ordinal + 1);
		return {
			identity: `contributor:${token}:${ordinal}`,
			path: document.kind === "work" ? `/authors/${index}/author/key` : `/authors/${index}/key`,
			key,
			role,
			creditedAs,
			position: index,
		};
	});
}
const tocConstraints: CatalogDefinitionConstraints = {
	nullable: false,
	integer: false,
	rules: [
		{ position: 0, parent: null, memberKey: null, kind: "object", nullable: false, integer: false },
		...(["position", "level", "label", "title", "page", "class"] as const).map(
			(memberKey, index) => ({
				position: index + 1,
				parent: 0,
				memberKey,
				kind:
					memberKey === "position" || memberKey === "level"
						? ("number" as const)
						: ("string" as const),
				nullable: memberKey !== "position",
				integer: memberKey === "position" || memberKey === "level",
				...(memberKey === "position" || memberKey === "level"
					? { minimum: 0 }
					: { maxLength: 131072 }),
			}),
		),
	],
};
const linkConstraints: CatalogDefinitionConstraints = {
	nullable: false,
	integer: false,
	rules: [
		{ position: 0, parent: null, memberKey: null, kind: "object", nullable: false, integer: false },
		...(["url", "title"] as const).map((memberKey, index) => ({
			position: index + 1,
			parent: 0,
			memberKey,
			kind: "string" as const,
			nullable: memberKey === "title",
			integer: false,
			maxLength: 131072,
		})),
	],
};
/** Provider-neutral metadata values remain typed assertions; unresolved text/serial grain is never fabricated. */
export async function openLibraryFacts(
	tx: DatabaseTransaction,
	document: OpenLibraryDocument,
): Promise<CatalogSourceFactDescriptor[]> {
	const result: CatalogSourceFactDescriptor[] = [],
		record = document.record;
	const scalar = (
		key: string,
		value: string | number | boolean | undefined,
		path: string,
		identity = key,
	) => {
		if (value === undefined || value === "") return;
		if (typeof value === "string")
			result.push({ namespace: "catalog", key, identity, path, kind: "string", value });
		else if (typeof value === "number")
			result.push({ namespace: "catalog", key, identity, path, kind: "number", value });
		else result.push({ namespace: "catalog", key, identity, path, kind: "boolean", value });
	};
	const repeated = (key: string, values: readonly string[] | undefined, field: string) => {
		const seen = new Map<string, number>();
		values?.forEach((value, index) => {
			const token = identityHash(value),
				ordinal = seen.get(token) ?? 0;
			seen.set(token, ordinal + 1);
			scalar(key, value, `/${field}/${index}`, `${key}:${token}:${ordinal}`);
		});
	};
	const languages = (key: string, values: readonly { key: string }[] | undefined, field: string) =>
		values?.forEach((value, index) =>
			scalar(
				key,
				openLibraryLanguageTag(value.key),
				`/${field}/${index}/key`,
				`${key}:${value.key}:${index}`,
			),
		);
	if (document.kind === "author") {
		const author = document.record;
		scalar("description", openLibraryText(author.bio), "/bio");
		for (const [field, key] of [
			["enumeration", "name-enumeration"],
			["title", "name-title"],
			["location", "creator-location-statement"],
			["birth_date", "creator-birth-date-statement"],
			["death_date", "creator-death-date-statement"],
			["date", "creator-date-statement"],
			["wikipedia", "reference-url"],
		] as const)
			scalar(key, author[field], `/${field}`);
		scalar("name-eastern-order", author.eastern_order, "/eastern_order");
		repeated("reference-url", author.uris, "uris");
	} else {
		scalar("description", openLibraryText(document.record.description), "/description");
		scalar("annotation", openLibraryText(document.record.notes), "/notes");
		scalar("subtitle", document.record.subtitle, "/subtitle");
		scalar("opening-sentence", openLibraryText(document.record.first_sentence), "/first_sentence");
		repeated("subject-label", document.record.subjects, "subjects");
		document.record.covers?.forEach((value, index) =>
			value > 0
				? scalar(
						"cover-reference",
						`https://covers.openlibrary.org/b/id/${value}-L.jpg`,
						`/covers/${index}`,
						`cover:${value}:${index}`,
					)
				: undefined,
		);
		if (document.kind === "work") {
			const work = document.record;
			for (const [field, key] of [
				["subject_places", "subject-place-label"],
				["subject_times", "subject-time-label"],
				["subject_people", "subject-person-label"],
				["dewey_number", "classification.dewey"],
				["lc_classifications", "classification.library-of-congress"],
			] as const)
				repeated(key, work[field], field);
			languages("original-language", work.original_languages, "original_languages");
			const date = openLibraryDate(work.first_publish_date);
			if (date)
				result.push({
					namespace: "catalog",
					key: "first-issued-date",
					identity: "first-issued-date",
					path: "/first_publish_date",
					kind: "object",
					value: date,
				});
			else scalar("first-issued-date-statement", work.first_publish_date, "/first_publish_date");
			if (work.cover_edition)
				scalar("cover-publication-reference", work.cover_edition.key, "/cover_edition/key");
		} else {
			const edition = document.record;
			for (const [field, key] of [
				["title_prefix", "title-prefix"],
				["by_statement", "credit-statement"],
				["copyright_date", "copyright-date-statement"],
				["edition_name", "publication-version-statement"],
				["physical_dimensions", "physical-dimensions-statement"],
				["physical_format", "physical-format-statement"],
				["publish_country", "publication-country-marc-code"],
				["weight", "physical-weight-statement"],
				["translation_of", "translation-source-title"],
				["accompanying_material", "accompanying-material-statement"],
			] as const)
				scalar(key, edition[field], `/${field}`);
			for (const [field, key] of [
				["genres", "genre-label"],
				["work_titles", "contained-work-title"],
				["series", "series-title-statement"],
				["dewey_decimal_class", "classification.dewey"],
				["lc_classifications", "classification.library-of-congress"],
				["contributions", "contribution-statement"],
				["publish_places", "publication-place-statement"],
				["distributors", "distributor-statement"],
				["location", "holding-location-statement"],
				["uris", "reference-url"],
				["uri_descriptions", "reference-description"],
			] as const)
				repeated(key, edition[field], field);
			if ((edition.publishers?.length ?? 0) > 1)
				repeated("publisher-statement", edition.publishers, "publishers");
			languages("language", edition.languages, "languages");
			languages("translation-source-language", edition.translated_from, "translated_from");
			if (Object.keys(edition.classifications ?? {}).length) {
				const definition = await ensureCatalogDefinition(tx, {
					namespace: "catalog",
					key: "classification-claim",
					kind: "property",
					valueKind: "object",
					constraints: {
						rules: [
							{ position: 0, parent: null, memberKey: null, kind: "object" },
							{ position: 1, parent: 0, memberKey: "scheme", kind: "string", maxLength: 131072 },
							{ position: 2, parent: 0, memberKey: "notation", kind: "string", maxLength: 131072 },
						],
					},
				});
				for (const [scheme, notations] of Object.entries(edition.classifications ?? {}))
					for (const [index, notation] of notations.entries())
						result.push({
							definitionRevisionId: definition.revisionId,
							identity: `classification:${identityHash([scheme, notation])}:${index}`,
							path: `/classifications/${scheme.replace(/~/gu, "~0").replace(/\//gu, "~1")}/${index}`,
							kind: "object",
							value: { scheme, notation },
						});
			}
			if (edition.table_of_contents?.length) {
				const definition = await ensureCatalogDefinition(tx, {
					namespace: "catalog",
					key: "contents-entry",
					kind: "property",
					valueKind: "object",
					constraints: tocConstraints,
				});
				for (const [position, entry] of edition.table_of_contents.entries())
					result.push({
						definitionRevisionId: definition.revisionId,
						identity: `contents-entry:${position}`,
						path: `/table_of_contents/${position}`,
						kind: "object",
						value: {
							position,
							level: entry.level ?? null,
							label: entry.label ?? null,
							title: entry.title ?? null,
							page: entry.pagenum ?? null,
							class: entry.class ?? null,
						},
					});
			}
		}
	}
	const sourceLinks = record.links;
	if (Array.isArray(sourceLinks) && sourceLinks.length) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "catalog",
			key: "described-link",
			kind: "property",
			valueKind: "object",
			constraints: linkConstraints,
		});
		for (const [index, link] of z
			.array(z.object({ url: z.string(), title: z.string().optional() }))
			.parse(sourceLinks)
			.entries())
			result.push({
				definitionRevisionId: definition.revisionId,
				identity: `link:${identityHash([link.url, link.title ?? null])}:${index}`,
				path: `/links/${index}`,
				kind: "object",
				value: { url: link.url, title: link.title ?? null },
			});
	}
	return result;
}
export function openLibraryPhysicalFormat(value: string | undefined) {
	switch (value?.trim().toLowerCase()) {
		case "paperback":
		case "softcover":
			return "paperback";
		case "hardcover":
		case "hardback":
			return "hardcover";
		default:
			return null;
	}
}
