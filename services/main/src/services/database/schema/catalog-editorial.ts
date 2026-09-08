import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, jsonb, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { FontAwesomeIconPrefixValues, type AvatarType, type FontAwesomeIconPrefix } from "@rezics/avatar";
import type { CatalogOwner } from "../../catalog/contracts";
import { pgTable } from "./base";
import { CatalogIdentityTables } from "./catalog-identity";
import { imageAsset } from "./image";
import { users } from "./auth";
import { createCreatedAtColumn, createJsonDocumentColumn } from "./columns";

function editorialTables(owner: CatalogOwner) {
	const current = pgTable(`${owner}_editorial`, {
		ownerId: uuid().notNull().references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
		language: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
		state: text().$type<"active" | "withdrawn">().notNull(),
		summary: text(), description: createJsonDocumentColumn(),
		avatarType: text().$type<AvatarType>(),
		avatarAssetId: uuid().references(() => imageAsset.id, { onDelete: "restrict" }),
		avatarEmoji: text(), avatarIconPrefix: text().$type<FontAwesomeIconPrefix>(), avatarIconName: text(),
		bannerAssetId: uuid().references(() => imageAsset.id, { onDelete: "restrict" }),
		coverAssetId: uuid().references(() => imageAsset.id, { onDelete: "restrict" }),
		operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(), updatedAt: createCreatedAtColumn(),
	}, table => [
		primaryKey({ columns: [table.ownerId, table.language] }),
		check(`${owner}_editorial_revision_check`, sql`${table.revision} between 1 and 9007199254740991`),
		check(`${owner}_editorial_language_check`, sql`octet_length(${table.language}) between 1 and 255`),
		check(`${owner}_editorial_state_check`, sql`${table.state} in ('active','withdrawn')`),
		check(`${owner}_editorial_summary_check`, sql`${table.summary} is null or char_length(${table.summary}) <= 500`),
		check(`${owner}_editorial_description_check`, sql`${table.description} is null or (jsonb_typeof(${table.description})='object' and octet_length(${table.description}::text) <= 1048576)`),
		check(`${owner}_editorial_avatar_check`, sql`
		 (${table.avatarType} is null and num_nonnulls(${table.avatarAssetId},${table.avatarEmoji},${table.avatarIconPrefix},${table.avatarIconName})=0)
		 or (${table.avatarType}='image' and ${table.avatarAssetId} is not null and num_nonnulls(${table.avatarEmoji},${table.avatarIconPrefix},${table.avatarIconName})=0)
		 or (${table.avatarType}='emoji' and char_length(${table.avatarEmoji}) between 1 and 64 and ${table.avatarEmoji} is not null and num_nonnulls(${table.avatarAssetId},${table.avatarIconPrefix},${table.avatarIconName})=0)
		 or (${table.avatarType}='icon' and ${table.avatarIconPrefix} in (${sql.join(FontAwesomeIconPrefixValues.map(value => sql`${value}`),sql`,`)}) and ${table.avatarIconPrefix} is not null and ${table.avatarIconName} is not null and ${table.avatarIconName} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${table.avatarIconName}) <= 128 and num_nonnulls(${table.avatarAssetId},${table.avatarEmoji})=0)`),
	]);
	const history = pgTable(`${owner}_editorial_revision`, {
		ownerId: uuid().notNull(), language: text().notNull(), revision: bigint({ mode: "number" }).notNull(),
		snapshot: jsonb().$type<unknown>().notNull(), createdAt: createCreatedAtColumn(),
	}, table => [
		primaryKey({ columns: [table.ownerId, table.language, table.revision] }),
		foreignKey({ columns: [table.ownerId, table.language], foreignColumns: [current.ownerId, current.language], name: `${owner}_editorial_revision_owner_fk` }).onDelete("restrict"),
		check(`${owner}_editorial_revision_snapshot_check`, sql`jsonb_typeof(${table.snapshot})='object' and octet_length(${table.snapshot}::text) <= 1100000`),
	]);
	return { current, history };
}

/** @alpha @remarks Optional editorial copy belongs to each native owner; it does not confer public Entity control. */
export const CatalogEditorialTables = {
	publishing: editorialTables("publishing"), music: editorialTables("music"), program: editorialTables("program"),
	software: editorialTables("software"), entity: editorialTables("entity"), grouping: editorialTables("grouping"),
	reference: editorialTables("reference"), distribution: editorialTables("distribution"),
};
export const { current: publishingEditorial, history: publishingEditorialRevision } = CatalogEditorialTables.publishing;
export const { current: musicEditorial, history: musicEditorialRevision } = CatalogEditorialTables.music;
export const { current: programEditorial, history: programEditorialRevision } = CatalogEditorialTables.program;
export const { current: softwareEditorial, history: softwareEditorialRevision } = CatalogEditorialTables.software;
export const { current: entityEditorial, history: entityEditorialRevision } = CatalogEditorialTables.entity;
export const { current: groupingEditorial, history: groupingEditorialRevision } = CatalogEditorialTables.grouping;
export const { current: referenceEditorial, history: referenceEditorialRevision } = CatalogEditorialTables.reference;
export const { current: distributionEditorial, history: distributionEditorialRevision } = CatalogEditorialTables.distribution;
