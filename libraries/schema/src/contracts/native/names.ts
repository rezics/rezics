import { z } from "zod";
import { parseContentLanguageTag } from "@rezics/content-language";
import { CatalogFactStateValues, CatalogPartialDateSchema } from "./catalog";

const boundedText = (maximum: number) =>
	z
		.string()
		.min(1)
		.refine((value) => Buffer.byteLength(value, "utf8") <= maximum);
export const CatalogRevisionNumberSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const CatalogNameOriginValues = [
	"original",
	"translation",
	"transliteration",
	"abbreviation",
	"variant",
	"unknown",
] as const;
export const CatalogTranslationMethodValues = [
	"human",
	"machine",
	"mixed",
	"unknown",
	"not_applicable",
] as const;

/**
 * Complete named-form revision; language and method never imply authorization.
 * @alpha
 * @remarks Native catalog editing contract. Multiple names in the same language remain independent identities.
 */
export const CatalogNameInputSchema = z
	.strictObject({
		value: boundedText(131_072),
		kind: boundedText(96),
		sortName: boundedText(131_072).nullable().default(null),
		languageTag: boundedText(255).nullable(),
		privateUseNamespace: boundedText(512).nullable().default(null),
		origin: z.enum(CatalogNameOriginValues).default("unknown"),
		translationMethod: z.enum(CatalogTranslationMethodValues).default("unknown"),
		primaryForLanguage: z.boolean().nullable().default(null),
		scopeOwnerId: z.uuid().nullable().default(null),
		territory: boundedText(96).nullable().default(null),
		context: boundedText(512).nullable().default(null),
		derivationNameId: z.uuid().nullable().default(null),
		derivationRevision: CatalogRevisionNumberSchema.nullable().default(null),
		begin: CatalogPartialDateSchema.nullable().default(null),
		end: CatalogPartialDateSchema.nullable().default(null),
		ended: z.boolean().nullable().default(null),
		spoiler: z.number().int().min(0).max(2).default(0),
		state: z.enum(CatalogFactStateValues).default("active"),
	})
	.superRefine((value, context) => {
		if ((value.derivationNameId === null) !== (value.derivationRevision === null))
			context.addIssue({
				code: "custom",
				path: ["derivationRevision"],
				message: "Derivation requires an exact named-form revision",
			});
		if (value.languageTag === null && value.privateUseNamespace !== null)
			context.addIssue({
				code: "custom",
				path: ["privateUseNamespace"],
				message: "Private-use namespace requires a language tag",
			});
	});

export const CatalogNameValuesSchema = CatalogNameInputSchema.transform((value) => {
	const language =
		value.languageTag === null
			? null
			: parseContentLanguageTag(value.languageTag, {
					privateUseNamespace: value.privateUseNamespace ?? undefined,
				});
	return {
		...value,
		languageTag: language?.tag ?? null,
		privateUseNamespace: language?.kind === "private-use" ? language.namespace : null,
		languagePolicy: language?.policy ?? null,
	};
});
export type CatalogNameInput = z.input<typeof CatalogNameValuesSchema>;

export const CatalogNameEvidenceSchema = z.strictObject({
	sourceRecordId: z.uuid(),
	snapshotId: z.uuid(),
	sourcePath: boundedText(4096),
});

/**
 * A source claim and an authorization decision are different states of knowledge.
 * @alpha
 * @remarks Verification requires a named authorizer and review evidence, scoped to an exact immutable form revision.
 */
export const CatalogNameAuthorityValuesSchema = z
	.strictObject({
		nameId: z.uuid(),
		nameRevision: CatalogRevisionNumberSchema,
		claim: z.enum(["official", "unofficial", "unknown"]),
		reviewState: z.enum(["source_claim", "pending", "verified", "rejected"]),
		authorizerEntityId: z.uuid().nullable(),
		role: boundedText(96),
		territory: boundedText(96).nullable(),
		channel: boundedText(96).nullable(),
		context: boundedText(512).nullable(),
		validFrom: z.iso.datetime({ offset: true }).nullable(),
		validUntil: z.iso.datetime({ offset: true }).nullable(),
		evidence: CatalogNameEvidenceSchema,
		reviewEvidence: CatalogNameEvidenceSchema.nullable(),
		state: z.enum(["active", "withdrawn"]),
	})
	.superRefine((value, context) => {
		if (
			value.reviewState === "verified" &&
			(value.authorizerEntityId === null || value.reviewEvidence === null)
		)
			context.addIssue({
				code: "custom",
				path: ["reviewState"],
				message: "Verified authorization requires a named authorizer and exact review evidence",
			});
		if (
			value.validFrom &&
			value.validUntil &&
			Date.parse(value.validUntil) <= Date.parse(value.validFrom)
		)
			context.addIssue({
				code: "custom",
				path: ["validUntil"],
				message: "Authority validity must be a nonempty interval",
			});
	});
export type CatalogNameAuthorityInput = z.input<typeof CatalogNameAuthorityValuesSchema>;

/** @alpha @remarks Identifier rules are explicit namespace policies, never identity merge rules. */
export const CatalogIdentifierValuesSchema = z.strictObject({
	namespace: z.string().regex(/^[a-z][a-z0-9_.:-]{0,127}$/u),
	value: boundedText(512),
	issuerEntityId: z.uuid().nullable().default(null),
	state: z.enum(CatalogFactStateValues).default("active"),
});
export type CatalogIdentifierInput = z.input<typeof CatalogIdentifierValuesSchema>;

/**
 * Normalize only reviewed namespace syntax. Preserve unknown namespace values exactly.
 * @alpha
 * @remarks A valid code may still be misassigned or duplicated; matches produce claims, never automatic merges.
 */
export function normalizeCatalogIdentifier(input: CatalogIdentifierInput) {
	const value = CatalogIdentifierValuesSchema.parse(input);
	let normalizedValue = value.value;
	let normalizationPolicy = "exact.1";
	if (value.namespace === "isrc") {
		normalizedValue = value.value.replace(/[- ]/gu, "").toUpperCase();
		if (!/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/u.test(normalizedValue))
			throw new TypeError("Invalid ISRC syntax");
		normalizationPolicy = "isrc.1";
	} else if (value.namespace === "isbn") {
		normalizedValue = value.value.replace(/[- ]/gu, "").toUpperCase();
		const isbn10 =
			/^[0-9]{9}[0-9X]$/u.test(normalizedValue) &&
			[...normalizedValue].reduce(
				(sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index),
				0,
			) %
				11 ===
				0;
		const isbn13 =
			/^97[89][0-9]{10}$/u.test(normalizedValue) &&
			[...normalizedValue].reduce(
				(sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1),
				0,
			) %
				10 ===
				0;
		if (!isbn10 && !isbn13) throw new TypeError("Invalid ISBN check digit");
		normalizationPolicy = "isbn.1";
	} else if (value.namespace === "gtin" || value.namespace === "barcode") {
		normalizedValue = value.value.replace(/ /gu, "");
		if (
			!/^(?:[0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$/u.test(normalizedValue) ||
			[...normalizedValue]
				.reverse()
				.reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) %
				10 !==
				0
		)
			throw new TypeError("Invalid GTIN check digit");
		normalizationPolicy = "gtin.1";
	} else if (value.namespace === "musicbrainz" || value.namespace.startsWith("musicbrainz:")) {
		normalizedValue = z.uuid().parse(value.value).toLowerCase();
		normalizationPolicy = "uuid.1";
	}
	return {
		...value,
		normalizedValue,
		normalizationPolicy,
		validationStatus:
			normalizationPolicy === "exact.1" ? ("unvalidated" as const) : ("valid" as const),
	};
}
