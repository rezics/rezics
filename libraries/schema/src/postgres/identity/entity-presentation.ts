import { inArray, sql } from "drizzle-orm";
import { bigint, check, foreignKey, jsonb, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import {
	AvatarTypeValues,
	FontAwesomeIconPrefixValues,
	FontAwesomeIconNamePatternSource,
	type AvatarType,
	type FontAwesomeIconPrefix,
} from "@rezics/avatar";
import { pgTable } from "../shared/base";
import { entityIdentity } from "../catalog/identity";
import { CatalogNameTables } from "../knowledge/names";
import { imageAsset } from "../media/image";
import { users } from "./auth";
import {
	createCreatedAtColumn,
	createJsonDocumentColumn,
	createUpdatedAtColumn,
} from "../shared/columns";

/** Optional public presentation for a native Entity, with independently versioned language variants. */
export const entityPresentation = pgTable(
	"entity_presentation",
	{
		entityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		language: text().notNull(),
		nameId: uuid(),
		nameRevision: bigint({ mode: "number" }),
		avatarType: text().$type<AvatarType>(),
		avatarAssetId: uuid().references(() => imageAsset.id, { onDelete: "restrict" }),
		avatarEmoji: text(),
		avatarIconPrefix: text().$type<FontAwesomeIconPrefix>(),
		avatarIconName: text(),
		bannerAssetId: uuid().references(() => imageAsset.id, { onDelete: "restrict" }),
		summary: text(),
		description: createJsonDocumentColumn(),
		revision: bigint({ mode: "number" }).notNull().default(1),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.entityId, table.language] }),
		foreignKey({
			name: "entity_presentation_name_fk",
			columns: [table.entityId, table.nameId, table.nameRevision],
			foreignColumns: [
				CatalogNameTables.entity.nameRevision.ownerId,
				CatalogNameTables.entity.nameRevision.id,
				CatalogNameTables.entity.nameRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"entity_presentation_name_shape_check",
			sql`num_nonnulls(${table.nameId}, ${table.nameRevision}) in (0,2)`,
		),
		check(
			"entity_presentation_language_check",
			sql`octet_length(${table.language}) between 1 and 255`,
		),
		check(
			"entity_presentation_summary_check",
			sql`${table.summary} is null or char_length(${table.summary}) <= 500`,
		),
		check(
			"entity_presentation_description_check",
			sql`${table.description} is null or (jsonb_typeof(${table.description}) = 'object' and octet_length(${table.description}::text) <= 1048576)`,
		),
		check(
			"entity_presentation_revision_check",
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check("entity_presentation_avatar_type_check", inArray(table.avatarType, AvatarTypeValues)),
		check(
			"entity_presentation_avatar_check",
			sql`
		(${table.avatarType} is null and num_nonnulls(${table.avatarAssetId},${table.avatarEmoji},${table.avatarIconPrefix},${table.avatarIconName}) = 0)
		or (${table.avatarType} = 'image' and ${table.avatarAssetId} is not null and num_nonnulls(${table.avatarEmoji},${table.avatarIconPrefix},${table.avatarIconName}) = 0)
		or (${table.avatarType} = 'emoji' and ${table.avatarEmoji} is not null and char_length(${table.avatarEmoji}) between 1 and 64 and num_nonnulls(${table.avatarAssetId},${table.avatarIconPrefix},${table.avatarIconName}) = 0)
		or (${table.avatarType} = 'icon' and ${table.avatarAssetId} is null and ${table.avatarEmoji} is null
			and ${table.avatarIconPrefix} in (${sql.join(
				FontAwesomeIconPrefixValues.map((value) => sql`${value}`),
				sql`, `,
			)})
			and ${table.avatarIconName} is not null and ${table.avatarIconName} ~ ${FontAwesomeIconNamePatternSource} and char_length(${table.avatarIconName}) <= 128)`,
		),
	],
);

/** Immutable public presentation snapshots; the actual account operator remains private. */
export const entityPresentationRevision = pgTable(
	"entity_presentation_revision",
	{
		entityId: uuid().notNull(),
		language: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		snapshot: jsonb().$type<unknown>().notNull(),
		operatorAuthUserId: uuid()
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.entityId, table.language, table.revision] }),
		foreignKey({
			name: "entity_presentation_revision_identity_fk",
			columns: [table.entityId, table.language],
			foreignColumns: [entityPresentation.entityId, entityPresentation.language],
		}).onDelete("restrict"),
		check(
			"entity_presentation_revision_snapshot_check",
			sql`jsonb_typeof(${table.snapshot}) = 'object' and octet_length(${table.snapshot}::text) <= 1100000`,
		),
	],
);
