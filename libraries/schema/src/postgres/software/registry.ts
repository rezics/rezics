import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	jsonb,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { softwareIdentity } from "../catalog/identity";
import { mediaBlob } from "../media/indexing";
import { entityIdentity } from "../catalog/identity";

/** @alpha Package coordinates, immutable artifacts and installations are different identities. */
export const registryPackage = pgTable(
	"registry_package",
	{
		id: uuid().primaryKey(),
		ecosystem: text().notNull(),
		namespace: text().notNull(),
		name: text().notNull(),
		workId: uuid().references(() => softwareIdentity.id),
		kind: text().notNull(),
	},
	(t) => [
		unique("registry_package_coordinate").on(t.ecosystem, t.namespace, t.name),
		check(
			"registry_package_kind",
			sql`${t.kind} in ('software','skill','prompt','mcp','plugin','model')`,
		),
	],
);
export const registryRelease = pgTable(
	"registry_release",
	{
		packageId: uuid()
			.notNull()
			.references(() => registryPackage.id),
		id: uuid().notNull(),
		version: text().notNull(),
		digest: text().notNull(),
		manifest: jsonb().$type<Record<string, unknown>>().notNull(),
		state: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.packageId, t.id] }),
		unique("registry_release_version").on(t.packageId, t.version),
		check("registry_release_state", sql`${t.state} in ('draft','published','withdrawn')`),
	],
);
export const registryFile = pgTable(
	"registry_file",
	{
		packageId: uuid().notNull(),
		releaseId: uuid().notNull(),
		path: text().notNull(),
		blobId: uuid()
			.notNull()
			.references(() => mediaBlob.id),
		mediaType: text().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.packageId, t.releaseId, t.path] }),
		foreignKey({
			columns: [t.packageId, t.releaseId],
			foreignColumns: [registryRelease.packageId, registryRelease.id],
		}),
		check(
			"registry_file_path",
			sql`${t.path}<>'' and ${t.path} not like '/%' and ${t.path} !~ '(^|/)[.][.](/|$)'`,
		),
	],
);
export const registryDependency = pgTable(
	"registry_dependency",
	{
		packageId: uuid().notNull(),
		releaseId: uuid().notNull(),
		dependencyPackageId: uuid()
			.notNull()
			.references(() => registryPackage.id),
		range: text().notNull(),
		resolvedReleaseId: uuid(),
	},
	(t) => [
		primaryKey({ columns: [t.packageId, t.releaseId, t.dependencyPackageId] }),
		foreignKey({
			columns: [t.packageId, t.releaseId],
			foreignColumns: [registryRelease.packageId, registryRelease.id],
		}),
		foreignKey({
			columns: [t.dependencyPackageId, t.resolvedReleaseId],
			foreignColumns: [registryRelease.packageId, registryRelease.id],
		}),
	],
);
export const registryInstallation = pgTable(
	"registry_installation",
	{
		id: uuid().primaryKey(),
		ownerEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id),
		packageId: uuid().notNull(),
		releaseId: uuid().notNull(),
		state: text().notNull(),
		revision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		foreignKey({
			columns: [t.packageId, t.releaseId],
			foreignColumns: [registryRelease.packageId, registryRelease.id],
		}),
		index("registry_installation_owner").on(t.ownerEntityId, t.id),
		check(
			"registry_installation_state",
			sql`${t.state} in ('installed','disabled','removed') and ${t.revision}>0`,
		),
	],
);
export const registryCapabilityDeclaration = pgTable(
	"registry_capability_declaration",
	{
		packageId: uuid().notNull(),
		releaseId: uuid().notNull(),
		capability: text().notNull(),
		contract: jsonb().$type<Record<string, unknown>>().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.packageId, t.releaseId, t.capability] }),
		foreignKey({
			columns: [t.packageId, t.releaseId],
			foreignColumns: [registryRelease.packageId, registryRelease.id],
		}),
	],
);
