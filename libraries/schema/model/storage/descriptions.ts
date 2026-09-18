import type { StorageModule } from "../../src/model/contracts";
/** Reviewed semantic identity, exact interpretation and evidence storage. */
export const storage: StorageModule = {
	key: "descriptions",
	output: "src/postgres/knowledge/descriptions.generated.ts",
	tableImports: {
		"../identity/auth": ["users"],
		"../media/indexing.generated": ["mediaBlob"],
		"../vocabulary/model.generated": ["schemaModelProfile"],
		"../vocabulary/registry.generated": ["schemaTerm", "schemaDefinition"],
		"../knowledge/reference-value": ["referenceValue"],
	},
	tables: [
		{
			symbol: "assertionAssessment",
			name: "assertion_assessment",
			meaning:
				"A human/AI assessment targets the exact assertion and method version, separate from acceptance.",
			decision:
				"A human/AI assessment targets the exact assertion and method version, separate from acceptance.",
			sourceTerms: ["http://www.w3.org/ns/oa#Annotation"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				objectId: {
					type: "uuid",
					required: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				statementId: {
					type: "uuid",
					required: true,
				},
				issuerUserId: {
					type: "uuid",
				},
				methodIri: {
					type: "text",
					required: true,
				},
				methodVersion: {
					type: "text",
					required: true,
				},
				verdict: {
					type: "text",
					required: true,
				},
				evidenceDigest: {
					type: "text",
					required: true,
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "foreign",
					name: "assertion_assessment_issuer_user_id_users_id_fkey",
					columns: ["issuerUserId"],
					table: "users",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "assertion_assessment_5bW8Sj4oMsAe_fkey",
					columns: ["objectId", "revisionId", "statementId"],
					table: "descriptionStatement",
					target: ["objectId", "revisionId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "assertion_assessment_verdict",
					expression: "{verdict} in ('supported','refuted','disputed','abstained','unavailable')",
				},
				{
					kind: "index",
					name: "assertion_assessment_target",
					columns: ["objectId", "revisionId", "statementId", "id"],
				},
			],
		},
		{
			symbol: "descriptionChange",
			name: "description_change",
			meaning: "Editing and source/review evidence share one change identity.",
			decision: "Editing and source/review evidence share one change identity.",
			sourceTerms: ["http://www.w3.org/ns/prov#Activity"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				objectId: {
					type: "uuid",
					required: true,
				},
				actorUserId: {
					type: "uuid",
				},
				nonce: {
					type: "text",
					required: true,
				},
				payloadDigest: {
					type: "text",
					required: true,
				},
				summary: {
					type: "text",
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "description_change_scope",
					columns: ["id", "objectId"],
				},
				{
					kind: "unique",
					name: "description_change_receipt",
					columns: ["objectId", "nonce"],
				},
				{
					kind: "foreign",
					name: "description_change_object_id_description_object_id_fkey",
					columns: ["objectId"],
					table: "descriptionObject",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_change_actor_user_id_users_id_fkey",
					columns: ["actorUserId"],
					table: "users",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
			],
		},
		{
			symbol: "descriptionEvidence",
			name: "description_evidence",
			meaning:
				"Evidence targets an exact assertion revision; a reference does not duplicate the source subject.",
			decision:
				"Evidence targets an exact assertion revision; a reference does not duplicate the source subject.",
			sourceTerms: ["http://www.w3.org/ns/prov#wasDerivedFrom"],
			columns: {
				objectId: {
					type: "uuid",
					required: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				statementId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				sourceUri: {
					type: "text",
				},
				snapshotBlobId: {
					type: "uuid",
				},
				selector: {
					type: "jsonb",
					typeScript: "Record<string, unknown>",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["objectId", "revisionId", "statementId", "id"],
				},
				{
					kind: "foreign",
					name: "description_evidence_snapshot_blob_id_media_blob_id_fkey",
					columns: ["snapshotBlobId"],
					table: "mediaBlob",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_evidence_qxw1WpQfJbYr_fkey",
					columns: ["objectId", "revisionId", "statementId"],
					table: "descriptionStatement",
					target: ["objectId", "revisionId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "description_evidence_reference",
					expression: "num_nonnulls({sourceUri},{snapshotBlobId})>0",
				},
			],
		},
		{
			symbol: "descriptionObject",
			name: "description_object",
			meaning:
				"General semantic identity for explicitly selected description profiles; no universal parent for native content.",
			decision:
				"General semantic identity for explicitly selected description profiles; no universal parent for native content.",
			sourceTerms: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
				visibility: {
					type: "text",
					required: true,
				},
				state: {
					type: "text",
					required: true,
				},
				controlRevision: {
					type: "bigint",
					required: true,
					defaultSql: "1",
				},
			},
			constraints: [
				{
					kind: "check",
					name: "description_object_state",
					expression:
						"{visibility} in ('public','unlisted','private') and {state} in ('draft','published','withdrawn','erased') and {controlRevision}>0",
				},
			],
		},
		{
			symbol: "descriptionRevision",
			name: "description_revision",
			meaning:
				"Exact model/profile and parent pins preserve interpretation across standard updates.",
			decision:
				"Exact model/profile and parent pins preserve interpretation across standard updates.",
			sourceTerms: ["http://www.w3.org/ns/prov#wasRevisionOf"],
			columns: {
				objectId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				modelId: {
					type: "uuid",
					required: true,
				},
				profileKey: {
					type: "text",
					required: true,
				},
				parentId: {
					type: "uuid",
				},
				changeId: {
					type: "uuid",
					required: true,
				},
				payloadState: {
					type: "text",
					required: true,
					defaultSql: "'available'",
				},
				createdAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["objectId", "id"],
				},
				{
					kind: "foreign",
					name: "description_revision_object_id_description_object_id_fkey",
					columns: ["objectId"],
					table: "descriptionObject",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_revision_2_model_fk",
					columns: ["modelId", "profileKey"],
					table: "schemaModelProfile",
					target: ["modelId", "key"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_revision_aaUpG9AIhchI_fkey",
					columns: ["objectId", "parentId"],
					table: "descriptionRevision",
					target: ["objectId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_revision_U5NFVX0p0Lwp_fkey",
					columns: ["changeId", "objectId"],
					table: "descriptionChange",
					target: ["id", "objectId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "description_revision_payload",
					expression: "{payloadState} in ('available','erased')",
				},
			],
		},
		{
			symbol: "descriptionSelection",
			name: "description_selection",
			meaning: "Adoption is an explicit versioned decision, independent of latest edit.",
			decision: "Adoption is an explicit versioned decision, independent of latest edit.",
			sourceTerms: ["http://www.w3.org/ns/prov#Activity"],
			columns: {
				objectId: {
					type: "uuid",
					required: true,
					primary: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				version: {
					type: "bigint",
					required: true,
				},
				changeId: {
					type: "uuid",
					required: true,
				},
			},
			constraints: [
				{
					kind: "foreign",
					name: "description_selection_object_id_description_object_id_fkey",
					columns: ["objectId"],
					table: "descriptionObject",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_selection_buRmZZAaauhc_fkey",
					columns: ["objectId", "revisionId"],
					table: "descriptionRevision",
					target: ["objectId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_selection_pyP0fmmasuzK_fkey",
					columns: ["changeId", "objectId"],
					table: "descriptionChange",
					target: ["id", "objectId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "description_selection_version",
					expression: "{version}>0",
				},
			],
		},
		{
			symbol: "descriptionStatement",
			name: "description_statement",
			meaning:
				"Queryable typed assertion occurrences retain absent/unknown/no-value distinctions and exact lexical values.",
			decision:
				"Queryable typed assertion occurrences retain absent/unknown/no-value distinctions and exact lexical values.",
			sourceTerms: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#Statement"],
			columns: {
				objectId: {
					type: "uuid",
					required: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				predicateId: {
					type: "uuid",
					required: true,
				},
				state: {
					type: "text",
					required: true,
				},
				datatypeId: {
					type: "uuid",
				},
				lexical: {
					type: "text",
				},
				language: {
					type: "text",
				},
				valueHash: {
					type: "text",
				},
				nativeTargetRefId: {
					type: "uuid",
				},
				descriptionTargetId: {
					type: "uuid",
				},
				externalIri: {
					type: "text",
				},
				orderKey: {
					type: "text",
				},
				definitionId: {
					type: "uuid",
					required: true,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["objectId", "revisionId", "id"],
				},
				{
					kind: "foreign",
					name: "description_statement_predicate_id_schema_term_id_fkey",
					columns: ["predicateId"],
					table: "schemaTerm",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_statement_datatype_id_schema_term_id_fkey",
					columns: ["datatypeId"],
					table: "schemaTerm",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_statement_n514jfOvpmBO_fkey",
					columns: ["nativeTargetRefId"],
					table: "referenceValue",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_statement_jjegsCPNwjDO_fkey",
					columns: ["descriptionTargetId"],
					table: "descriptionObject",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_statement_Tx3hZZkE7gHv_fkey",
					columns: ["objectId", "revisionId"],
					table: "descriptionRevision",
					target: ["objectId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "description_statement_order",
					expression: "{orderKey} is null or {orderKey} ~ '^(0|[1-9][0-9]{0,39})$'",
				},
				{
					kind: "check",
					name: "description_statement_value",
					expression:
						"({state}='literal' and {datatypeId} is not null and {lexical} is not null and {valueHash} is not null and num_nonnulls({nativeTargetRefId},{descriptionTargetId},{externalIri})=0)\n or ({state}='reference' and num_nonnulls({nativeTargetRefId},{descriptionTargetId},{externalIri})=1 and num_nonnulls({datatypeId},{lexical},{language},{valueHash})=0)\n or ({state} in ('unknown','no-value') and num_nonnulls({nativeTargetRefId},{descriptionTargetId},{externalIri},{datatypeId},{lexical},{language},{valueHash})=0)",
				},
				{
					kind: "index",
					name: "description_statement_predicate",
					columns: ["predicateId", "objectId", "revisionId", "id"],
				},
				{
					kind: "index",
					name: "description_statement_literal",
					columns: ["predicateId", "datatypeId", "valueHash", "objectId"],
				},
				{
					kind: "index",
					name: "description_statement_native_reverse",
					columns: ["nativeTargetRefId", "predicateId", "objectId"],
				},
				{
					kind: "index",
					name: "description_statement_description_reverse",
					columns: ["descriptionTargetId", "predicateId", "objectId"],
				},
				{
					kind: "foreign",
					name: "description_statement_meaning_fk",
					columns: ["definitionId", "predicateId"],
					table: "schemaDefinition",
					target: ["id", "termId"],
				},
			],
		},
		{
			symbol: "descriptionType",
			name: "description_type",
			meaning: "Explicit declared types are assertions and confer no permissions.",
			decision: "Explicit declared types are assertions and confer no permissions.",
			sourceTerms: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#type"],
			columns: {
				objectId: {
					type: "uuid",
					required: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				typeId: {
					type: "uuid",
					required: true,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["objectId", "revisionId", "typeId"],
				},
				{
					kind: "foreign",
					name: "description_type_type_id_schema_term_id_fkey",
					columns: ["typeId"],
					table: "schemaTerm",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "description_type_CS17Zr4FRiNg_fkey",
					columns: ["objectId", "revisionId"],
					table: "descriptionRevision",
					target: ["objectId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "index",
					name: "description_type_reverse",
					columns: ["typeId", "objectId", "revisionId"],
				},
			],
		},
	],
};
