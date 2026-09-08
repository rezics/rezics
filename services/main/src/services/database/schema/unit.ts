import { unitReferenceColumns, unitReferenceConstraints } from "./unit-reference-columns";
import {
	type AvatarType,
	AvatarTypeValues,
	FontAwesomeIconNamePatternSource,
	type FontAwesomeIconPrefix,
	FontAwesomeIconPrefixValues,
} from "@rezics/avatar";
import {
	type LicenseId,
	type LicenseRecognitionStatus,
	LicenseIds,
	LicenseRecognitionStatusValues,
} from "@rezics/license";
import { inArray, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	pgEnum,
	primaryKey,
	text,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import { entityIdentity } from "./catalog-identity";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import {
	AliasKindValues,
	type ContentLanguage,
	ContentLanguageValues,
	ContentStatusValues,
	toEnumValues,
	type UnitReferenceCurationKind,
	UnitReferenceCurationKindValues,
} from "./contract-values";

import { imageAsset } from "./image";
import { CanonicalPgroongaIndexes } from "./pgroonga";

const PgroongaMetadataLargeOptions = {
	lexicon_flags_mapping: `'{"current_search_metadata_v1":["LARGE"]}'`,
	index_flags_mapping: `'{"current_search_metadata_v1":["LARGE"]}'`,
} as const;

const PgroongaContentLargeOptions = {
	lexicon_flags_mapping: `'{"current_search_text_v1":["LARGE"]}'`,
	index_flags_mapping: `'{"current_search_text_v1":["LARGE"]}'`,
} as const;

export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));

export const unitLocalization = pgTable(
	"unit_localization",
	{
		unitId: uuid().notNull(),
		language: text().$type<ContentLanguage>().notNull(),
		/**
		 * Fractional index in the Unit's content-language fallback sequence.
		 * Reader preferences are resolved first; this order is used only when no
		 * requested language is available.
		 */
		position: fractionalIndexPosition()
			.default(sql`('a0' || replace(uuidv7()::text, '-', '') || 'V')`)
			.notNull(),
		/** Compact identity artwork; fixed product terminology across every Unit kind. */
		avatarType: text().$type<AvatarType>(),
		avatarAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "restrict",
		}),
		avatarEmoji: text(),
		avatarIconPrefix: text().$type<FontAwesomeIconPrefix>(),
		avatarIconName: text(),
		/** Wide header artwork; fixed product terminology across every Unit kind. */
		bannerAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "set null",
		}),
		/** Primary editorial artwork; fixed product terminology across every Unit kind. */
		coverAssetId: uuid().references((): AnyPgColumn => imageAsset.id, {
			onDelete: "set null",
		}),
		title: text(),
		summary: text(),
		description: createJsonDocumentColumn(),
		content: createJsonDocumentColumn(),
		contentStatus: contentStatus(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_localization", "unit", table, false, table.unitId),

		primaryKey({ columns: [table.unitId, table.language] }),
		unique("unit_localization_unit_position_key").on(table.unitId, table.position),
		index("unit_localization_unit_position_idx").on(table.unitId, table.position, table.language),
		index("unit_localization_language_unit_idx").on(table.language, table.unitId),
		index("unit_localization_content_status_idx").on(table.contentStatus, table.updatedAt),
		index(CanonicalPgroongaIndexes[0])
			.using(
				"pgroonga",
				sql`(public.current_search_metadata_v1(${table.title}, ${table.summary}, ${table.description})) public.pgroonga_text_full_text_search_ops_v2`,
			)
			.with(PgroongaMetadataLargeOptions),
		index(CanonicalPgroongaIndexes[1])
			.using(
				"pgroonga",
				sql`(public.current_search_text_v1(${table.content})) public.pgroonga_text_full_text_search_ops_v2`,
			)
			.with(PgroongaContentLargeOptions),
		check("unit_localization_language_check", inArray(table.language, ContentLanguageValues)),
		check("unit_localization_avatar_type_check", inArray(table.avatarType, AvatarTypeValues)),
		check(
			"unit_localization_avatar_value_check",
			sql`(
				${table.avatarType} is null
				and ${table.avatarAssetId} is null
				and ${table.avatarEmoji} is null
				and ${table.avatarIconPrefix} is null
				and ${table.avatarIconName} is null
			) or (
				${table.avatarType} = 'image'
				and ${table.avatarAssetId} is not null
				and ${table.avatarEmoji} is null
				and ${table.avatarIconPrefix} is null
				and ${table.avatarIconName} is null
			) or (
				${table.avatarType} = 'emoji'
				and ${table.avatarAssetId} is null
				and ${table.avatarEmoji} is not null
				and char_length(${table.avatarEmoji}) <= 64
				and ${table.avatarIconPrefix} is null
				and ${table.avatarIconName} is null
			) or (
				${table.avatarType} = 'icon'
				and ${table.avatarAssetId} is null
				and ${table.avatarEmoji} is null
				and ${table.avatarIconPrefix} is not null
				and ${table.avatarIconPrefix} in (${sql.join(
					FontAwesomeIconPrefixValues.map((prefix) => sql`${prefix}`),
					sql`, `,
				)})
				and ${table.avatarIconName} is not null
				and ${table.avatarIconName} ~ ${FontAwesomeIconNamePatternSource}
				and char_length(${table.avatarIconName}) <= 128
			)`,
		),
		check(
			"unit_localization_value_check",
			sql`${table.avatarType} is not null or ${table.bannerAssetId} is not null or ${table.coverAssetId} is not null or ${table.title} is not null or ${table.summary} is not null or ${table.description} is not null or ${table.content} is not null`,
		),
		check(
			"unit_localization_content_state_check",
			sql`(${table.content} is null) = (${table.contentStatus} is null)`,
		),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_localization_position_byte_length_check",
			table.position,
		),
	],
);

export const aliasKind = pgEnum("alias_kind", toEnumValues(AliasKindValues));

export const unitAlias = pgTable(
	"unit_alias",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid().notNull(),
		/** @UNIT_LOCALIZATION_EXEMPT Search synonym: language-tagged lookup term, never canonical Unit display copy. */
		term: text().notNull(),
		normalizedTerm: text().notNull(),
		language: text().$type<ContentLanguage>(),
		kind: aliasKind().default("common").notNull(),
		createdByProfileId: uuid().references((): AnyPgColumn => entityIdentity.id, {
			onDelete: "set null",
		}),
		withdrawnAt: createTimestampMsColumn(),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_alias", "unit", table, false, table.unitId),

		unique("unit_alias_unit_language_normalized_key")
			.on(table.unitId, table.language, table.normalizedTerm)
			.nullsNotDistinct(),
		index("unit_alias_normalized_idx").on(table.normalizedTerm),
		index(CanonicalPgroongaIndexes[2]).using("pgroonga", table.term),
		index("unit_alias_created_by_idx").on(table.createdByProfileId),
		index("unit_alias_unit_position_idx")
			.on(table.unitId, table.pinned, table.position, table.id)
			.where(sql`${table.withdrawnAt} is null`),
		uniqueIndex("unit_alias_unit_pinned_position_unique")
			.on(table.unitId, table.position)
			.where(sql`${table.pinned} and ${table.withdrawnAt} is null`),
		check(
			"unit_alias_term_not_blank",
			sql`btrim(${table.term}) <> '' and btrim(${table.normalizedTerm}) <> ''`,
		),
		check(
			"unit_alias_language_check",
			sql`${table.language} is null or ${inArray(table.language, ContentLanguageValues)}`,
		),
		check(
			"unit_alias_pinned_position_check",
			sql`(${table.pinned} and ${table.position} is not null)
					or (not ${table.pinned} and ${table.position} is null)`,
		),
		check(
			"unit_alias_withdrawn_curation_check",
			sql`${table.withdrawnAt} is null or (not ${table.pinned} and ${table.position} is null)`,
		),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_alias_position_byte_length_check",
			table.position,
		),
	],
);

export const unitAliasVote = pgTable(
	"unit_alias_vote",
	{
		aliasId: uuid()
			.notNull()
			.references(() => unitAlias.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references((): AnyPgColumn => entityIdentity.id, { onDelete: "cascade" }),
		value: integer().$type<-1 | 1>().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.aliasId, table.profileId] }),
		index("unit_alias_vote_profile_idx").on(table.profileId),
		check("unit_alias_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

export const unitLicenseRecognitionStatus = pgEnum(
	"unit_license_recognition_status",
	toEnumValues(LicenseRecognitionStatusValues),
);

/**
 * Append-only ledger of independent license grants and rights statements.
 *
 * Grant identity, terms, actor, and time are immutable facts. Ending an
 * offering records that the Unit no longer currently offers those terms; it
 * does not erase the grant. Platform recognition is independent of offering.
 */
export const unitLicenseGrant = pgTable(
	"unit_license_grant",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid().notNull(),
		licenseId: text().$type<LicenseId>().notNull(),
		grantedByProfileId: uuid(),
		grantedAt: createTimestampMsColumn().defaultNow().notNull(),
		offeringEndedAt: createTimestampMsColumn(),
		offeringEndedByProfileId: uuid(),
		recognitionStatus: unitLicenseRecognitionStatus()
			.$type<LicenseRecognitionStatus>()
			.default("recognized")
			.notNull(),

		...unitReferenceColumns("unit", "restrict"),
	},
	(table) => [
		...unitReferenceConstraints("unit_license_grant", "unit", table, false, table.unitId),

		foreignKey({
			name: "unit_license_grant_granted_by_profile_id_profile_id_fkey",
			columns: [table.grantedByProfileId],
			foreignColumns: [entityIdentity.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "unit_license_grant_offering_ended_by_profile_id_profile_id_fkey",
			columns: [table.offeringEndedByProfileId],
			foreignColumns: [entityIdentity.id],
		}).onDelete("restrict"),
		uniqueIndex("unit_license_grant_open_unit_license_key")
			.on(table.unitId, table.licenseId)
			.where(sql`${table.offeringEndedAt} is null`),
		check("unit_license_grant_license_id_check", inArray(table.licenseId, LicenseIds)),
		index("unit_license_grant_unit_granted_at_idx").on(table.unitId, table.grantedAt.desc()),
		index("unit_license_grant_effective_license_unit_idx")
			.on(table.licenseId, table.unitId)
			.where(sql`${table.offeringEndedAt} is null and ${table.recognitionStatus} = 'recognized'`),
		check(
			"unit_license_grant_offering_end_check",
			sql`(
				(
					${table.offeringEndedAt} is null
					and ${table.offeringEndedByProfileId} is null
				) or (
					${table.offeringEndedAt} is not null
					and ${table.offeringEndedByProfileId} is not null
				)
			)`,
		),
	],
);

export const unitExternalLink = pgTable(
	"unit_external_link",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid().notNull(),
		sourceEntityId: uuid()
			.notNull()
			.references((): AnyPgColumn => entityIdentity.id, { onDelete: "restrict" }),
		url: text().notNull(),
		normalizedUrl: text().notNull(),
		normalizedUrlHash: text().notNull(),
		createdByProfileId: uuid().references((): AnyPgColumn => entityIdentity.id, {
			onDelete: "set null",
		}),
		withdrawnAt: createTimestampMsColumn(),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_external_link", "unit", table, false, table.unitId),

		unique("unit_external_link_unit_source_hash_key").on(
			table.unitId,
			table.sourceEntityId,
			table.normalizedUrlHash,
		),
		index("unit_external_link_unit_position_idx")
			.on(table.unitId, table.pinned, table.position, table.id)
			.where(sql`${table.withdrawnAt} is null`),
		uniqueIndex("unit_external_link_unit_pinned_position_unique")
			.on(table.unitId, table.position)
			.where(sql`${table.pinned} and ${table.withdrawnAt} is null`),
		index("unit_external_link_source_entity_idx").on(table.sourceEntityId),
		index("unit_external_link_created_by_idx").on(table.createdByProfileId),
		check(
			"unit_external_link_url_check",
			sql`${table.url} ~ '^https?://' and ${table.normalizedUrl} ~ '^https?://'`,
		),
		check("unit_external_link_hash_check", sql`${table.normalizedUrlHash} ~ '^[0-9a-f]{64}$'`),
		check(
			"unit_external_link_pinned_position_check",
			sql`(${table.pinned} and ${table.position} is not null)
					or (not ${table.pinned} and ${table.position} is null)`,
		),
		check(
			"unit_external_link_withdrawn_curation_check",
			sql`${table.withdrawnAt} is null or (not ${table.pinned} and ${table.position} is null)`,
		),
		createFractionalIndexPositionByteLengthConstraint(
			"unit_external_link_position_byte_length_check",
			table.position,
		),
	],
);

export const unitExternalLinkVote = pgTable(
	"unit_external_link_vote",
	{
		externalLinkId: uuid()
			.notNull()
			.references(() => unitExternalLink.id, { onDelete: "cascade" }),
		profileId: uuid()
			.notNull()
			.references((): AnyPgColumn => entityIdentity.id, { onDelete: "cascade" }),
		value: integer().$type<-1 | 1>().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.externalLinkId, table.profileId] }),
		index("unit_external_link_vote_profile_idx").on(table.profileId),
		check("unit_external_link_vote_value_check", sql`${table.value} in (-1, 1)`),
	],
);

/** Optimistic-concurrency head for ordering each Unit reference list. */
export const unitReferenceCurationHead = pgTable(
	"unit_reference_curation_head",
	{
		unitId: uuid().notNull(),
		kind: text().$type<UnitReferenceCurationKind>().notNull(),
		version: integer().default(0).notNull(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("unit_reference_curation_head", "unit", table, false, table.unitId),

		primaryKey({ columns: [table.unitId, table.kind] }),
		check(
			"unit_reference_curation_head_kind_check",
			inArray(table.kind, UnitReferenceCurationKindValues),
		),
		check("unit_reference_curation_head_version_check", sql`${table.version} >= 0`),
	],
);
