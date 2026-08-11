import {
	AvatarTypeValues,
	FontAwesomeIconNamePatternSource,
	FontAwesomeIconPrefixValues,
	type AvatarType,
	type FontAwesomeIconPrefix,
} from "@rezics/avatar";
import { UnitContentLicenseSlugs, type UnitContentLicenseSlug } from "@rezics/license";
import type { PublicationLicenseId } from "@rezics/license";
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
import {
	AiDisclosureValues,
	AliasKindValues,
	type ContentLanguage,
	ContentLanguageValues,
	ContentRatingValues,
	ContentStatusValues,
	ModerationStatusValues,
	ResourceVisibilityValues,
	toEnumValues,
	UnitContentLicenseStatusValues,
	type UnitReferenceCurationKind,
	UnitReferenceCurationKindValues,
	type UnitKind,
	UnitKindValues,
	UnitStatusValues,
	type VariantCapableUnitKind,
	VariantCapableUnitKindValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createJsonDocumentColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { entity } from "./entity";
import { imageAsset } from "./image";
import { CanonicalPgroongaIndexes } from "./pgroonga";
import { profile } from "./profile";

const PgroongaMetadataLargeOptions = {
	lexicon_flags_mapping: `'{"current_search_metadata_v1":["LARGE"]}'`,
	index_flags_mapping: `'{"current_search_metadata_v1":["LARGE"]}'`,
} as const;

const PgroongaContentLargeOptions = {
	lexicon_flags_mapping: `'{"current_search_text_v1":["LARGE"]}'`,
	index_flags_mapping: `'{"current_search_text_v1":["LARGE"]}'`,
} as const;

export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const resourceVisibility = pgEnum(
	"resource_visibility",
	toEnumValues(ResourceVisibilityValues),
);
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));

export const unit = pgTable(
	"unit",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<UnitKind>().notNull(),
		status: unitStatus().default("draft").notNull(),
		visibility: resourceVisibility().default("public").notNull(),
		contentRating: contentRating().default("general").notNull(),
		aiDisclosure: aiDisclosure().default("unknown").notNull(),
		/** Public-facing License selected for this Unit's work; never a grant to REZICS. */
		license: text().$type<PublicationLicenseId>(),
		moderationStatus: moderationStatus().default("approved").notNull(),
		/** Rejects creation of new Post relations that target this Unit. */
		postTargetingLocked: boolean().default(false).notNull(),
		publishedAt: createTimestampMsColumn(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_public_discoverable_idx")
			.on(table.id)
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_created_at_asc_idx")
			.on(table.createdAt.asc(), table.id.asc())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_created_at_desc_idx")
			.on(table.createdAt.desc().nullsFirst(), table.id.desc().nullsFirst())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_updated_at_asc_idx")
			.on(table.updatedAt.asc(), table.id.asc())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_updated_at_desc_idx")
			.on(table.updatedAt.desc().nullsFirst(), table.id.desc().nullsFirst())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_kind_created_at_desc_idx")
			.on(table.kind, table.createdAt.desc().nullsFirst(), table.id.desc().nullsFirst())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_kind_updated_at_desc_idx")
			.on(table.kind, table.updatedAt.desc().nullsFirst(), table.id.desc().nullsFirst())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_published_at_asc_idx")
			.on(table.publishedAt.asc(), table.id.asc())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_public_published_at_desc_idx")
			.on(table.publishedAt.desc().nullsLast(), table.id.desc().nullsFirst())
			.where(
				sql`${table.status} = 'published'::unit_status and ${table.visibility} = 'public'::resource_visibility and ${table.moderationStatus} = 'approved'::moderation_status and ${table.deletedAt} is null`,
			),
		index("unit_kind_status_created_at_idx")
			.on(table.kind, table.status, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_status_visibility_created_at_idx")
			.on(table.status, table.visibility, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_moderation_status_idx").on(table.moderationStatus),
		unique("unit_id_kind_key").on(table.id, table.kind),
		check("unit_kind_check", inArray(table.kind, UnitKindValues)),
		check(
			"unit_publication_check",
			sql`${table.status} <> 'published'::unit_status or ${table.publishedAt} is not null`,
		),
		check(
			"unit_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);

export const contentStatus = pgEnum("content_status", toEnumValues(ContentStatusValues));

export const unitLocalization = pgTable(
	"unit_localization",
	{
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
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
	},
	(table) => [
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
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		/** @UNIT_LOCALIZATION_EXEMPT Search synonym: language-tagged lookup term, never canonical Unit display copy. */
		term: text().notNull(),
		normalizedTerm: text().notNull(),
		language: text().$type<ContentLanguage>(),
		kind: aliasKind().default("common").notNull(),
		createdByProfileId: uuid().references((): AnyPgColumn => profile.id, {
			onDelete: "set null",
		}),
		withdrawnAt: createTimestampMsColumn(),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
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
			.references((): AnyPgColumn => profile.id, { onDelete: "cascade" }),
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

export const unitVariant = pgTable(
	"unit_variant",
	{
		variantUnitId: uuid().primaryKey(),
		mainUnitId: uuid().notNull(),
		unitKind: text().$type<VariantCapableUnitKind>().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		foreignKey({
			columns: [table.variantUnitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_variant_variant_kind_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.mainUnitId, table.unitKind],
			foreignColumns: [unit.id, unit.kind],
			name: "unit_variant_main_kind_fkey",
		}).onDelete("restrict"),
		index("unit_variant_main_created_at_idx").on(
			table.mainUnitId,
			table.createdAt,
			table.variantUnitId,
		),
		check("unit_variant_kind_check", inArray(table.unitKind, VariantCapableUnitKindValues)),
		check("unit_variant_not_self_check", sql`${table.variantUnitId} <> ${table.mainUnitId}`),
	],
);

export const unitContentLicenseStatus = pgEnum(
	"unit_content_license_status",
	toEnumValues(UnitContentLicenseStatusValues),
);

/**
 * One recorded grant of the referenced REZICS content license for a Unit.
 *
 * Grant identity, actor, terms, and time are immutable. Platform governance can
 * reversibly invalidate its recognition of a grant without erasing that
 * historical assertion. At most one grant is active for a Unit.
 */
export const unitContentLicense = pgTable(
	"unit_content_license",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		grantedByProfileId: uuid()
			.notNull()
			.references((): AnyPgColumn => profile.id, { onDelete: "restrict" }),
		referenceLicenseSlug: text().$type<UnitContentLicenseSlug>().notNull(),
		grantedAt: createTimestampMsColumn().defaultNow().notNull(),
		status: unitContentLicenseStatus().default("active").notNull(),
	},
	(table) => [
		uniqueIndex("unit_content_license_active_unit_key")
			.on(table.unitId)
			.where(sql`${table.status} = 'active'`),
		index("unit_content_license_unit_granted_at_idx").on(table.unitId, table.grantedAt.desc()),
		index("unit_content_license_granted_by_idx").on(table.grantedByProfileId),
		index("unit_content_license_reference_slug_idx").on(table.referenceLicenseSlug),
		check(
			"unit_content_license_reference_slug_check",
			inArray(table.referenceLicenseSlug, UnitContentLicenseSlugs),
		),
	],
);

export const unitExternalLink = pgTable(
	"unit_external_link",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		sourceEntityId: uuid()
			.notNull()
			.references((): AnyPgColumn => entity.id, { onDelete: "restrict" }),
		url: text().notNull(),
		normalizedUrl: text().notNull(),
		normalizedUrlHash: text().notNull(),
		createdByProfileId: uuid().references((): AnyPgColumn => profile.id, {
			onDelete: "set null",
		}),
		withdrawnAt: createTimestampMsColumn(),
		pinned: boolean().default(false).notNull(),
		position: fractionalIndexPosition(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
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
			.references((): AnyPgColumn => profile.id, { onDelete: "cascade" }),
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
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().$type<UnitReferenceCurationKind>().notNull(),
		version: integer().default(0).notNull(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.unitId, table.kind] }),
		check(
			"unit_reference_curation_head_kind_check",
			inArray(table.kind, UnitReferenceCurationKindValues),
		),
		check("unit_reference_curation_head_version_check", sql`${table.version} >= 0`),
	],
);
