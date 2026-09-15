import { and, inArray, or, sql } from "drizzle-orm";
import { bigint, boolean, check, foreignKey, index, integer, primaryKey, text, timestamp, uniqueIndex, uuid, type PgTableExtraConfigValue } from "drizzle-orm/pg-core";
import { AccessManagementPermissionValues, AccessPermissionValues, PlatformCapabilityValues, UnitPermissionValues } from "@rezics/access";
import { ApiPermissionValues } from "../../auth/api-permissions";
import { pgTable } from "./base";
import { createCreatedAtColumn, createUuidv7PrimaryKey } from "./columns";
import { users } from "./auth";
import { accessScope, accessSubject } from "./access-identity";
import { connectedApp, connectedAppRevision } from "./connected-app";
import { workloadPrincipal } from "./workload-principal";
import { entityIdentity } from "./catalog-identity";
import { accessRoleBindingRevision } from "./access-role-binding";
import { accessRepresentationRevision } from "./access-representation";

/** Scope-owned App instance; installer history never replaces its immutable owner/workload. @internal */
export const connectedInstallation = pgTable("connected_installation", {
	id: createUuidv7PrimaryKey(),
	appId: uuid().notNull().references(() => connectedApp.id, { onDelete: "restrict" }),
	ownerScopeId: uuid().notNull().references(() => accessScope.id, { onDelete: "restrict" }),
	workloadPrincipalId: uuid().notNull(),
	version: bigint({ mode: "number" }).notNull().default(0),
	credentialEpoch: bigint({ mode: "number" }).notNull().default(0),
	approvedRevision: bigint({ mode: "number" }),
	state: text().$type<"draft" | "pending" | "active" | "suspended" | "revoked">().notNull().default("draft"),
}, (table): PgTableExtraConfigValue[] => [
	uniqueIndex("connected_installation_app_key").on(table.id, table.appId),
	uniqueIndex("connected_installation_workload_key").on(table.workloadPrincipalId),
	uniqueIndex("connected_installation_workload_app_key").on(table.workloadPrincipalId, table.appId),
	index("connected_installation_owner_idx").on(table.ownerScopeId, table.id),
	index("connected_installation_app_idx").on(table.appId, table.id),
	foreignKey({ name: "connected_installation_workload_scope_fk", columns: [table.workloadPrincipalId, table.ownerScopeId],
		foreignColumns: [workloadPrincipal.authUserId, workloadPrincipal.ownerScopeId] }).onDelete("restrict"),
	foreignKey({ name: "connected_installation_approval_fk", columns: [table.id, table.approvedRevision],
		foreignColumns: [connectedInstallationRevision.installationId, connectedInstallationRevision.revision] }).onDelete("restrict"),
	check("connected_installation_version_check", sql`${table.version} between 0 and 9007199254740991 and ${table.credentialEpoch} between 0 and ${table.version} and (${table.approvedRevision} is null or ${table.approvedRevision} between 1 and ${table.version})`),
	check("connected_installation_state_check", sql`(${table.state}='draft' and ${table.version}=0 and ${table.credentialEpoch}=0 and ${table.approvedRevision} is null) or
		(${table.state} in ('pending','active','suspended','revoked') and ${table.version}>0 and ${table.credentialEpoch}>0 and
		 (${table.state} not in ('active','suspended') or ${table.approvedRevision} is not null) and (${table.state}<>'pending' or ${table.approvedRevision} is null))`),
]);

/** Immutable installation transition and private accountability; approvals are separate snapshots. @internal */
export const connectedInstallationEvent = pgTable("connected_installation_event", {
	installationId: uuid().notNull().references(() => connectedInstallation.id, { onDelete: "restrict" }),
	version: bigint({ mode: "number" }).notNull(), operationId: uuid().notNull(), requestDigest: text().notNull(),
	operation: text().$type<"prepare" | "approve" | "suspend" | "resume" | "revoke">().notNull(),
	stateAfter: text().$type<"pending" | "active" | "suspended" | "revoked">().notNull(),
	credentialEpochAfter: bigint({ mode: "number" }).notNull(),
	retainedApprovedRevision: bigint({ mode: "number" }),
	operatorAuthUserId: uuid().notNull().references(() => users.id, { onDelete: "restrict" }),
	authoritySubjectId: uuid().notNull().references(() => accessSubject.id, { onDelete: "restrict" }),
	createdAt: createCreatedAtColumn(),
}, (table): PgTableExtraConfigValue[] => [
	primaryKey({ columns: [table.installationId, table.version] }),
	uniqueIndex("connected_installation_event_operation_key").on(table.installationId, table.operationId),
	foreignKey({ name: "connected_installation_event_retained_approval_fk", columns: [table.installationId, table.retainedApprovedRevision],
		foreignColumns: [connectedInstallationRevision.installationId, connectedInstallationRevision.revision] }).onDelete("restrict"),
	check("connected_installation_event_version_check", sql`${table.version} between 1 and 9007199254740991 and ${table.credentialEpochAfter} between 1 and ${table.version}`),
	check("connected_installation_event_digest_check", sql`${table.requestDigest} ~ '^[0-9a-f]{64}$'`),
	check("connected_installation_event_operation_check", inArray(table.operation, ["prepare", "approve", "suspend", "resume", "revoke"])),
	check("connected_installation_event_state_check", inArray(table.stateAfter, ["pending", "active", "suspended", "revoked"])),
	check("connected_installation_event_approval_check", sql`(${table.operation} in ('prepare','approve') and ${table.retainedApprovedRevision} is null) or
		(${table.operation} not in ('prepare','approve') and (${table.retainedApprovedRevision} is null or ${table.retainedApprovedRevision} between 1 and ${table.version}-1))`),
]);

/** Exact approved App capabilities, resource-binding references and optional public-attribution context. @internal */
export const connectedInstallationRevision = pgTable("connected_installation_revision", {
	installationId: uuid().notNull(), revision: bigint({ mode: "number" }).notNull(), appId: uuid().notNull(), appRevision: bigint({ mode: "number" }).notNull(),
	validFrom: timestamp({ withTimezone: true, precision: 3, mode: "date" }).notNull(), validUntil: timestamp({ withTimezone: true, precision: 3, mode: "date" }),
	capabilityCount: integer().notNull(), capabilityDigest: text().notNull(), bindingCount: integer().notNull(), bindingDigest: text().notNull(),
	attributionEntityId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
	attributionCount: integer().notNull(), attributionDigest: text().notNull(), sealed: boolean().notNull().default(false),
}, (table): PgTableExtraConfigValue[] => [
	primaryKey({ columns: [table.installationId, table.revision] }),
	foreignKey({ name: "connected_installation_revision_event_fk", columns: [table.installationId, table.revision],
		foreignColumns: [connectedInstallationEvent.installationId, connectedInstallationEvent.version] }).onDelete("restrict"),
	foreignKey({ name: "connected_installation_revision_owner_fk", columns: [table.installationId, table.appId],
		foreignColumns: [connectedInstallation.id, connectedInstallation.appId] }).onDelete("restrict"),
	foreignKey({ name: "connected_installation_revision_app_fk", columns: [table.appId, table.appRevision],
		foreignColumns: [connectedAppRevision.appId, connectedAppRevision.revision] }).onDelete("restrict"),
	index("connected_installation_revision_app_idx").on(table.appId, table.appRevision, table.installationId, table.revision),
	check("connected_installation_revision_time_check", sql`isfinite(${table.validFrom}) and (${table.validUntil} is null or (isfinite(${table.validUntil}) and ${table.validUntil}>${table.validFrom}))`),
	check("connected_installation_revision_counts_check", sql`${table.capabilityCount} between 0 and ${sql.raw(String(AccessPermissionValues.length + ApiPermissionValues.length))} and ${table.bindingCount} between 0 and 64 and
		((${table.attributionEntityId} is null and ${table.attributionCount}=0) or (${table.attributionEntityId} is not null and ${table.attributionCount} between 1 and 8))`),
	check("connected_installation_revision_digests_check", sql`${table.capabilityDigest} ~ '^[0-9a-f]{64}$' and ${table.bindingDigest} ~ '^[0-9a-f]{64}$' and ${table.attributionDigest} ~ '^[0-9a-f]{64}$'`),
]);

/** Literal installation ceiling; neither an App declaration nor a Role can expand it. @internal */
export const connectedInstallationCapability = pgTable("connected_installation_capability", {
	installationId: uuid().notNull(), revision: bigint({ mode: "number" }).notNull(),
	family: text().$type<"api" | "unit" | "platform" | "management">().notNull(), capability: text().notNull(),
}, table => [
	primaryKey({ columns: [table.installationId, table.revision, table.family, table.capability] }),
	foreignKey({ name: "connected_installation_capability_revision_fk", columns: [table.installationId, table.revision], foreignColumns: [connectedInstallationRevision.installationId, connectedInstallationRevision.revision] }).onDelete("restrict"),
	check("connected_installation_capability_registered_check", or(
		and(sql`${table.family}='api'`, inArray(table.capability, ApiPermissionValues)), and(sql`${table.family}='unit'`, inArray(table.capability, UnitPermissionValues)),
		and(sql`${table.family}='platform'`, inArray(table.capability, PlatformCapabilityValues)), and(sql`${table.family}='management'`, inArray(table.capability, AccessManagementPermissionValues)),
	)),
]);

/** Approved resource paths remain owned by exact native frozen RoleBinding terms. @internal */
export const connectedInstallationBinding = pgTable("connected_installation_binding", {
	installationId: uuid().notNull(), revision: bigint({ mode: "number" }).notNull(), bindingId: uuid().notNull(), termsRevision: bigint({ mode: "number" }).notNull(),
}, table => [
	primaryKey({ columns: [table.installationId, table.revision, table.bindingId] }),
	foreignKey({ name: "connected_installation_binding_revision_fk", columns: [table.installationId, table.revision], foreignColumns: [connectedInstallationRevision.installationId, connectedInstallationRevision.revision] }).onDelete("restrict"),
	foreignKey({ name: "connected_installation_binding_terms_fk", columns: [table.bindingId, table.termsRevision], foreignColumns: [accessRoleBindingRevision.bindingId, accessRoleBindingRevision.revision] }).onDelete("restrict"),
	index("connected_installation_binding_source_idx").on(table.bindingId, table.termsRevision, table.installationId, table.revision),
]);

/** Optional attribution hints are revalidated for each public operation and never supply resource rights. @internal */
export const connectedInstallationAttribution = pgTable("connected_installation_attribution", {
	installationId: uuid().notNull(), revision: bigint({ mode: "number" }).notNull(), grantId: uuid().notNull(), termsRevision: bigint({ mode: "number" }).notNull(),
}, table => [
	primaryKey({ columns: [table.installationId, table.revision, table.grantId] }),
	foreignKey({ name: "connected_installation_attribution_revision_fk", columns: [table.installationId, table.revision], foreignColumns: [connectedInstallationRevision.installationId, connectedInstallationRevision.revision] }).onDelete("restrict"),
	foreignKey({ name: "connected_installation_attribution_terms_fk", columns: [table.grantId, table.termsRevision], foreignColumns: [accessRepresentationRevision.grantId, accessRepresentationRevision.revision] }).onDelete("restrict"),
	index("connected_installation_attribution_source_idx").on(table.grantId, table.termsRevision, table.installationId, table.revision),
]);
