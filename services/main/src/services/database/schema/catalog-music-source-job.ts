import { sql } from "drizzle-orm";
import { bigint, boolean, check, foreignKey, index, integer, jsonb, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { participationGrant, servicePrincipal } from "./participation";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import { CatalogIdentityTables } from "./catalog-identity";
import { catalogSourceAdoptionProposal, catalogSourceSnapshot } from "./catalog-source";
import type { ParticipationAuthority } from "../../participation/policy";

/** One current job per exact release proposal/action; bytes remain in the immutable source archive. */
export const musicReleaseSourceJob = pgTable("music_release_source_job", {
	sourceRecordId: uuid().notNull(), id: uuid().defaultRandom().notNull(), proposalId: uuid(), snapshotId: uuid().notNull(), musicId: uuid().references(() => CatalogIdentityTables.music.id, { onDelete: "restrict" }),
	action: text().$type<"initialize" | "apply" | "withdraw">().notNull(), reason: text().notNull(),
	authority: jsonb().$type<ParticipationAuthority>().notNull(),
	authorityAuthUserId: uuid().generatedAlwaysAs(sql`(authority->'principal'->>'authUserId')::uuid`).notNull().references(() => users.id, { onDelete: "restrict" }),
	authorityActingEntityId: uuid().generatedAlwaysAs(sql`(authority->>'actingEntityId')::uuid`).notNull().references(() => CatalogIdentityTables.entity.id, { onDelete: "restrict" }),
	authorityGrantId: uuid().generatedAlwaysAs(sql`(authority->'grant'->>'id')::uuid`).references(() => participationGrant.id, { onDelete: "restrict" }),
	authorityServicePrincipalId: uuid().generatedAlwaysAs(sql`(authority->'principal'->>'servicePrincipalId')::uuid`).references(() => servicePrincipal.id, { onDelete: "restrict" }),
	preparationComplete: boolean().notNull().default(false),
	nextDependencyPosition: integer().notNull().default(0),
	generation: bigint({ mode: "number" }).notNull().default(1),
	state: text().$type<"queued" | "prepared" | "paused" | "succeeded" | "superseded" | "blocked" | "failed">().notNull().default("queued"),
	preparation: jsonb().$type<{ beforeSnapshotId: string; afterSnapshotId: string; beforeSha256: string; afterSha256: string }>(),
	outcomeCode: text(), createdAt: createCreatedAtColumn(),
}, (t) => [
	index("music_release_source_job_music_idx").on(t.musicId, t.sourceRecordId, t.id).where(sql`${t.musicId} is not null`),
	index("music_release_source_job_auth_idx").on(t.authorityAuthUserId, t.sourceRecordId, t.id),
	index("music_release_source_job_entity_idx").on(t.authorityActingEntityId, t.sourceRecordId, t.id),
	index("music_release_source_job_grant_idx").on(t.authorityGrantId, t.sourceRecordId, t.id).where(sql`${t.authorityGrantId} is not null`),
	index("music_release_source_job_service_idx").on(t.authorityServicePrincipalId, t.sourceRecordId, t.id).where(sql`${t.authorityServicePrincipalId} is not null`),
	primaryKey({ columns: [t.sourceRecordId, t.id] }),
	uniqueIndex("music_release_source_job_proposal_idx").on(t.sourceRecordId, t.proposalId, t.action),
	uniqueIndex("music_release_source_job_initial_idx").on(t.sourceRecordId, t.snapshotId).where(sql`${t.action}='initialize'`),
	foreignKey({ columns: [t.sourceRecordId, t.snapshotId], foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id] }).onDelete("restrict"),
	foreignKey({ columns: [t.sourceRecordId, t.proposalId], foreignColumns: [catalogSourceAdoptionProposal.sourceRecordId, catalogSourceAdoptionProposal.id] }).onDelete("restrict"),
	check("music_release_source_job_values", sql`${t.action} in ('initialize','apply','withdraw') and ((${t.action}='initialize') = (${t.proposalId} is null)) and ${t.state} in ('queued','prepared','paused','succeeded','superseded','blocked','failed') and ${t.nextDependencyPosition} between 0 and 8192 and ${t.generation} between 1 and 9007199254740991 and octet_length(${t.reason}) between 1 and 8192 and octet_length(${t.authority}::text) <= 2048 and (${t.preparation} is null or octet_length(${t.preparation}::text) <= 1024) and (${t.outcomeCode} is null or octet_length(${t.outcomeCode}) <= 128)`),
]);
