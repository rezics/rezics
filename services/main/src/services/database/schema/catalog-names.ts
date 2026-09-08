import { inArray, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import {
	CatalogFactStateValues,
	type CatalogFactState,
	type CatalogOwner,
	type CatalogPartialDate,
} from "../../catalog/contracts";
import {
	CatalogNameOriginValues,
	CatalogTranslationMethodValues,
} from "../../catalog/name-contracts";
import { users } from "./auth";
import { pgTable } from "./base";
import { CatalogIdentityTables } from "./catalog-identity";
import {
	catalogSourceRecord,
	catalogSourceSnapshot,
	catalogSourceBindingRevision,
} from "./catalog-source";
import { createCreatedAtColumn, createTimestampMsColumn } from "./columns";

function identityValues(owner: CatalogOwner) {
	return {
		ownerId: uuid()
			.notNull()
			.references(() => CatalogIdentityTables[owner].id, { onDelete: "restrict" }),
		id: uuid().default(sql`uuidv7()`).notNull(),
		revision: bigint({ mode: "number" }).default(1).notNull(),
		createdAt: createCreatedAtColumn(),
		recordedAt: createCreatedAtColumn(),
		recordedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
	};
}
function nameValues(owner: CatalogOwner) {
	return {
		...identityValues(owner),
		languageTag: text(),
		privateUseNamespace: text(),
		languagePolicy: text(),
		kind: text().notNull(),
		value: text().notNull(),
		sortName: text(),
		origin: text().$type<(typeof CatalogNameOriginValues)[number]>().default("unknown").notNull(),
		translationMethod: text()
			.$type<(typeof CatalogTranslationMethodValues)[number]>()
			.default("unknown")
			.notNull(),
		primaryForLanguage: boolean(),
		scopeOwnerId: uuid().references(() => CatalogIdentityTables[owner].id, {
			onDelete: "restrict",
		}),
		territory: text(),
		context: text(),
		derivationNameId: uuid(),
		derivationRevision: bigint({ mode: "number" }),
		begin: jsonb().$type<CatalogPartialDate>(),
		end: jsonb().$type<CatalogPartialDate>(),
		ended: boolean(),
		spoiler: integer().default(0).notNull(),
		state: text().$type<CatalogFactState>().default("active").notNull(),
	};
}
function identifierValues(owner: CatalogOwner) {
	return {
		...identityValues(owner),
		namespace: text().notNull(),
		value: text().notNull(),
		normalizedValue: text().notNull(),
		normalizationPolicy: text().default("exact.1").notNull(),
		validationStatus: text().$type<"unvalidated" | "valid">().default("unvalidated").notNull(),
		issuerEntityId: uuid().references(() => CatalogIdentityTables.entity.id, {
			onDelete: "restrict",
		}),
		state: text().$type<CatalogFactState>().default("active").notNull(),
	};
}
function authorityValues(owner: CatalogOwner) {
	return {
		...identityValues(owner),
		nameId: uuid().notNull(),
		nameRevision: bigint({ mode: "number" }).notNull(),
		claim: text().$type<"official" | "unofficial" | "unknown">().notNull(),
		reviewState: text().$type<"source_claim" | "pending" | "verified" | "rejected">().notNull(),
		authorizerEntityId: uuid().references(() => CatalogIdentityTables.entity.id, {
			onDelete: "restrict",
		}),
		role: text().notNull(),
		territory: text(),
		channel: text(),
		context: text(),
		validFrom: createTimestampMsColumn(),
		validUntil: createTimestampMsColumn(),
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		sourcePath: text().notNull(),
		reviewSourceRecordId: uuid(),
		reviewSnapshotId: uuid(),
		reviewSourcePath: text(),
		state: text().$type<"active" | "withdrawn">().notNull(),
	};
}

/**
 * Owner-local stable identities and indexed current projections backed by complete immutable snapshots.
 * @alpha
 * @remarks PostgreSQL triggers append every insertion/edit, enforce consecutive heads and forbid history mutation.
 */
export function createCatalogNameTables(owner: CatalogOwner) {
	const name = pgTable(`${owner}_named_form`, nameValues(owner), (table) => [
		primaryKey({ name: `${owner}_named_form_identity_key`, columns: [table.ownerId, table.id] }),
		index(`${owner}_named_form_language_idx`).on(table.ownerId, table.languageTag, table.id),
		index(`${owner}_named_form_active_idx`)
			.on(table.ownerId, table.id)
			.where(sql`${table.state} = 'active'`),
		index(`${owner}_named_form_preview_idx`).on(table.ownerId,table.id)
			.where(sql`${table.state}='active' and ${table.spoiler}=0 and ${table.scopeOwnerId} is null`),
		index(`${owner}_named_form_scope_idx`)
			.on(table.scopeOwnerId, table.id)
			.where(sql`${table.scopeOwnerId} is not null`),
		check(`${owner}_named_form_state_check`, inArray(table.state, CatalogFactStateValues)),
		check(
			`${owner}_named_form_revision_check`,
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(`${owner}_named_form_kind_check`, sql`octet_length(${table.kind}) between 1 and 96`),
		check(
			`${owner}_named_form_value_check`,
			sql`octet_length(${table.value}) between 1 and 131072 and (${table.sortName} is null or octet_length(${table.sortName}) between 1 and 131072)`,
		),
		check(
			`${owner}_named_form_language_check`,
			sql`(${table.languageTag} is null and ${table.languagePolicy} is null and ${table.privateUseNamespace} is null) or (${table.languageTag} is not null and octet_length(${table.languageTag}) between 1 and 255 and ${table.languagePolicy} is not null and (${table.privateUseNamespace} is null or octet_length(${table.privateUseNamespace}) between 1 and 512))`,
		),
		check(`${owner}_named_form_origin_check`, inArray(table.origin, CatalogNameOriginValues)),
		check(
			`${owner}_named_form_method_check`,
			inArray(table.translationMethod, CatalogTranslationMethodValues),
		),
		check(
			`${owner}_named_form_derivation_check`,
			sql`num_nonnulls(${table.derivationNameId},${table.derivationRevision}) in (0,2)`,
		),
		check(`${owner}_named_form_spoiler_check`, sql`${table.spoiler} between 0 and 2`),
		check(
			`${owner}_named_form_scope_check`,
			sql`(${table.territory} is null or octet_length(${table.territory}) between 1 and 96) and (${table.context} is null or octet_length(${table.context}) between 1 and 512)`,
		),
	]);
	const nameRevision = pgTable(`${owner}_named_form_revision`, nameValues(owner), (table) => [
		primaryKey({
			name: `${owner}_named_form_revision_key`,
			columns: [table.ownerId, table.id, table.revision],
		}),
		foreignKey({
			name: `${owner}_named_form_revision_identity_fk`,
			columns: [table.ownerId, table.id],
			foreignColumns: [name.ownerId, name.id],
		}).onDelete("restrict"),
		foreignKey({
			name: `${owner}_named_form_derivation_fk`,
			columns: [table.ownerId, table.derivationNameId, table.derivationRevision],
			foreignColumns: [table.ownerId, table.id, table.revision],
		}).onDelete("restrict"),
		index(`${owner}_named_form_derivation_idx`)
			.on(table.ownerId, table.derivationNameId, table.derivationRevision)
			.where(sql`${table.derivationNameId} is not null`),
	]);
	const identifier = pgTable(`${owner}_identifier_claim`, identifierValues(owner), (table) => [
		primaryKey({ name: `${owner}_identifier_identity_key`, columns: [table.ownerId, table.id] }),
		index(`${owner}_identifier_lookup_idx`).on(
			table.namespace,
			table.normalizedValue,
			table.ownerId,
			table.id,
		),
		index(`${owner}_identifier_issuer_idx`)
			.on(table.issuerEntityId, table.id)
			.where(sql`${table.issuerEntityId} is not null`),
		check(
			`${owner}_identifier_namespace_check`,
			sql`${table.namespace} ~ '^[a-z][a-z0-9_.:-]{0,127}$'`,
		),
		check(
			`${owner}_identifier_value_check`,
			sql`octet_length(${table.value}) between 1 and 512 and octet_length(${table.normalizedValue}) between 1 and 512 and octet_length(${table.normalizationPolicy}) between 1 and 96`,
		),
		check(`${owner}_identifier_state_check`, inArray(table.state, CatalogFactStateValues)),
		check(
			`${owner}_identifier_validation_check`,
			inArray(table.validationStatus, ["unvalidated", "valid"]),
		),
		check(
			`${owner}_identifier_revision_check`,
			sql`${table.revision} between 1 and 9007199254740991`,
		),
	]);
	const identifierRevision = pgTable(
		`${owner}_identifier_claim_revision`,
		identifierValues(owner),
		(table) => [
			primaryKey({
				name: `${owner}_identifier_revision_key`,
				columns: [table.ownerId, table.id, table.revision],
			}),
			foreignKey({
				name: `${owner}_identifier_revision_identity_fk`,
				columns: [table.ownerId, table.id],
				foreignColumns: [identifier.ownerId, identifier.id],
			}).onDelete("restrict"),
		],
	);
	const authority = pgTable(`${owner}_name_authority`, authorityValues(owner), (table) => [
		primaryKey({ name: `${owner}_name_authority_key`, columns: [table.ownerId, table.id] }),
		foreignKey({
			name: `${owner}_name_authority_target_fk`,
			columns: [table.ownerId, table.nameId, table.nameRevision],
			foreignColumns: [nameRevision.ownerId, nameRevision.id, nameRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			name: `${owner}_name_authority_evidence_fk`,
			columns: [table.sourceRecordId, table.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: `${owner}_name_authority_review_fk`,
			columns: [table.reviewSourceRecordId, table.reviewSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		index(`${owner}_name_authority_target_idx`).on(
			table.ownerId,
			table.nameId,
			table.nameRevision,
			table.id,
		),
		index(`${owner}_name_authority_authorizer_idx`)
			.on(table.authorizerEntityId, table.ownerId, table.id)
			.where(sql`${table.authorizerEntityId} is not null`),
		index(`${owner}_name_authority_evidence_idx`).on(
			table.sourceRecordId,
			table.snapshotId,
			table.id,
		),
		index(`${owner}_name_authority_review_idx`)
			.on(table.reviewSourceRecordId, table.reviewSnapshotId, table.id)
			.where(sql`${table.reviewSourceRecordId} is not null`),
		check(
			`${owner}_name_authority_revision_check`,
			sql`${table.revision} between 1 and 9007199254740991`,
		),
		check(
			`${owner}_name_authority_claim_check`,
			inArray(table.claim, ["official", "unofficial", "unknown"]),
		),
		check(
			`${owner}_name_authority_review_check`,
			inArray(table.reviewState, ["source_claim", "pending", "verified", "rejected"]),
		),
		check(`${owner}_name_authority_state_check`, inArray(table.state, ["active", "withdrawn"])),
		check(
			`${owner}_name_authority_proof_check`,
			sql`(${table.reviewState} <> 'verified' or (${table.authorizerEntityId} is not null and ${table.reviewSnapshotId} is not null)) and num_nonnulls(${table.reviewSourceRecordId},${table.reviewSnapshotId},${table.reviewSourcePath}) in (0,3)`,
		),
		check(
			`${owner}_name_authority_time_check`,
			sql`${table.validFrom} is null or ${table.validUntil} is null or ${table.validUntil} > ${table.validFrom}`,
		),
		check(
			`${owner}_name_authority_scope_check`,
			sql`octet_length(${table.role}) between 1 and 96 and octet_length(${table.sourcePath}) between 1 and 4096 and (${table.reviewSourcePath} is null or octet_length(${table.reviewSourcePath}) between 1 and 4096) and (${table.territory} is null or octet_length(${table.territory}) between 1 and 96) and (${table.channel} is null or octet_length(${table.channel}) between 1 and 96) and (${table.context} is null or octet_length(${table.context}) between 1 and 512)`,
		),
	]);
	const authorityRevision = pgTable(
		`${owner}_name_authority_revision`,
		authorityValues(owner),
		(table) => [
			primaryKey({
				name: `${owner}_name_authority_revision_key`,
				columns: [table.ownerId, table.id, table.revision],
			}),
			foreignKey({
				name: `${owner}_name_authority_revision_identity_fk`,
				columns: [table.ownerId, table.id],
				foreignColumns: [authority.ownerId, authority.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_name_authority_history_target_fk`,
				columns: [table.ownerId, table.nameId, table.nameRevision],
				foreignColumns: [nameRevision.ownerId, nameRevision.id, nameRevision.revision],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_name_authority_history_evidence_fk`,
				columns: [table.sourceRecordId, table.snapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_name_authority_history_review_fk`,
				columns: [table.reviewSourceRecordId, table.reviewSnapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
		],
	);
	const sourceBinding = pgTable(
		`${owner}_name_source_binding`,
		{
			ownerId: uuid().notNull(),
			sourceRecordId: uuid()
				.notNull()
				.references(() => catalogSourceRecord.id, { onDelete: "restrict" }),
			mappingKey: uuid().notNull(),
			correspondenceRevision: bigint({ mode: "number" }).notNull(),
			namespace: text().notNull(),
			localKey: text().notNull(),
			nameId: uuid().notNull(),
			createdAt: createCreatedAtColumn(),
		},
		(table) => [
			primaryKey({
				name: `${owner}_name_source_binding_key`,
				columns: [
					table.sourceRecordId,
					table.mappingKey,
					table.correspondenceRevision,
					table.ownerId,
					table.namespace,
					table.localKey,
				],
			}),
			unique(`${owner}_name_source_binding_owner_key`).on(
				table.ownerId,
				table.sourceRecordId,
				table.mappingKey,
				table.correspondenceRevision,
				table.namespace,
				table.localKey,
				table.nameId,
			),
			foreignKey({
				name: `${owner}_name_source_binding_correspondence_fk`,
				columns: [table.sourceRecordId, table.mappingKey, table.correspondenceRevision],
				foreignColumns: [
					catalogSourceBindingRevision.sourceRecordId,
					catalogSourceBindingRevision.mappingKey,
					catalogSourceBindingRevision.revision,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_name_source_binding_name_fk`,
				columns: [table.ownerId, table.nameId],
				foreignColumns: [name.ownerId, name.id],
			}).onDelete("restrict"),
			index(`${owner}_name_source_binding_owner_idx`).on(table.ownerId, table.nameId),
			check(
				`${owner}_name_source_binding_value_check`,
				sql`octet_length(${table.namespace}) between 1 and 96 and octet_length(${table.localKey}) between 1 and 512`,
			),
		],
	);
	const sourceOccurrence = pgTable(
		`${owner}_name_source_occurrence`,
		{
			ownerId: uuid().notNull(),
			sourceRecordId: uuid().notNull(),
			mappingKey: uuid().notNull(),
			correspondenceRevision: bigint({ mode: "number" }).notNull(),
			namespace: text().notNull(),
			localKey: text().notNull(),
			nameId: uuid().notNull(),
			nameRevision: bigint({ mode: "number" }).notNull(),
			snapshotId: uuid().notNull(),
			sourcePath: text().notNull(),
			createdAt: createCreatedAtColumn(),
		},
		(table) => [
			primaryKey({
				name: `${owner}_name_source_occurrence_key`,
				columns: [
					table.sourceRecordId,
					table.mappingKey,
					table.correspondenceRevision,
					table.ownerId,
					table.namespace,
					table.localKey,
					table.snapshotId,
				],
			}),
			foreignKey({
				name: `${owner}_name_source_occurrence_binding_fk`,
				columns: [
					table.ownerId,
					table.sourceRecordId,
					table.mappingKey,
					table.correspondenceRevision,
					table.namespace,
					table.localKey,
					table.nameId,
				],
				foreignColumns: [
					sourceBinding.ownerId,
					sourceBinding.sourceRecordId,
					sourceBinding.mappingKey,
					sourceBinding.correspondenceRevision,
					sourceBinding.namespace,
					sourceBinding.localKey,
					sourceBinding.nameId,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_name_source_occurrence_name_fk`,
				columns: [table.ownerId, table.nameId, table.nameRevision],
				foreignColumns: [nameRevision.ownerId, nameRevision.id, nameRevision.revision],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_name_source_occurrence_snapshot_fk`,
				columns: [table.sourceRecordId, table.snapshotId],
				foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
			}).onDelete("restrict"),
			index(`${owner}_name_source_occurrence_name_idx`).on(
				table.ownerId,
				table.nameId,
				table.nameRevision,
			),
			index(`${owner}_name_source_occurrence_snapshot_idx`).on(
				table.sourceRecordId,
				table.mappingKey,
				table.correspondenceRevision,
				table.snapshotId,
			),
			check(
				`${owner}_name_source_occurrence_path_check`,
				sql`octet_length(${table.sourcePath}) between 1 and 4096`,
			),
		],
	);
	return {
		name,
		nameRevision,
		identifier,
		identifierRevision,
		authority,
		authorityRevision,
		sourceBinding,
		sourceOccurrence,
	};
}

export const CatalogNameTables = {
	publishing: createCatalogNameTables("publishing"),
	music: createCatalogNameTables("music"),
	program: createCatalogNameTables("program"),
	software: createCatalogNameTables("software"),
	entity: createCatalogNameTables("entity"),
	grouping: createCatalogNameTables("grouping"),
	reference: createCatalogNameTables("reference"),
	distribution: createCatalogNameTables("distribution"),
} as const;

export const {
	nameRevision: distributionNamedFormRevision,
	identifierRevision: distributionIdentifierClaimRevision,
	authority: distributionNameAuthority,
	authorityRevision: distributionNameAuthorityRevision,
	sourceBinding: distributionNameSourceBinding,
	sourceOccurrence: distributionNameSourceOccurrence,
} = CatalogNameTables.distribution;

export const {
	nameRevision: publishingNamedFormRevision,
	identifierRevision: publishingIdentifierClaimRevision,
	authority: publishingNameAuthority,
	authorityRevision: publishingNameAuthorityRevision,
} = CatalogNameTables.publishing;
export const {
	nameRevision: musicNamedFormRevision,
	identifierRevision: musicIdentifierClaimRevision,
	authority: musicNameAuthority,
	authorityRevision: musicNameAuthorityRevision,
} = CatalogNameTables.music;
export const {
	nameRevision: programNamedFormRevision,
	identifierRevision: programIdentifierClaimRevision,
	authority: programNameAuthority,
	authorityRevision: programNameAuthorityRevision,
} = CatalogNameTables.program;
export const {
	nameRevision: softwareNamedFormRevision,
	identifierRevision: softwareIdentifierClaimRevision,
	authority: softwareNameAuthority,
	authorityRevision: softwareNameAuthorityRevision,
} = CatalogNameTables.software;
export const {
	nameRevision: entityNamedFormRevision,
	identifierRevision: entityIdentifierClaimRevision,
	authority: entityNameAuthority,
	authorityRevision: entityNameAuthorityRevision,
} = CatalogNameTables.entity;
export const {
	nameRevision: groupingNamedFormRevision,
	identifierRevision: groupingIdentifierClaimRevision,
	authority: groupingNameAuthority,
	authorityRevision: groupingNameAuthorityRevision,
} = CatalogNameTables.grouping;
export const {
	nameRevision: referenceNamedFormRevision,
	identifierRevision: referenceIdentifierClaimRevision,
	authority: referenceNameAuthority,
	authorityRevision: referenceNameAuthorityRevision,
} = CatalogNameTables.reference;
export const {
	sourceBinding: publishingNameSourceBinding,
	sourceOccurrence: publishingNameSourceOccurrence,
} = CatalogNameTables.publishing;
export const {
	sourceBinding: musicNameSourceBinding,
	sourceOccurrence: musicNameSourceOccurrence,
} = CatalogNameTables.music;
export const {
	sourceBinding: programNameSourceBinding,
	sourceOccurrence: programNameSourceOccurrence,
} = CatalogNameTables.program;
export const {
	sourceBinding: softwareNameSourceBinding,
	sourceOccurrence: softwareNameSourceOccurrence,
} = CatalogNameTables.software;
export const {
	sourceBinding: entityNameSourceBinding,
	sourceOccurrence: entityNameSourceOccurrence,
} = CatalogNameTables.entity;
export const {
	sourceBinding: groupingNameSourceBinding,
	sourceOccurrence: groupingNameSourceOccurrence,
} = CatalogNameTables.grouping;
export const {
	sourceBinding: referenceNameSourceBinding,
	sourceOccurrence: referenceNameSourceOccurrence,
} = CatalogNameTables.reference;
