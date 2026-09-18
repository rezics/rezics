import type { StorageModule } from "../../src/model/contracts";
/** Reviewed native referents and storage invariants; generated Drizzle is output. */
export const storage: StorageModule = {
	key: "media-selection",
	output: "src/postgres/media/selection.generated.ts",
	tableImports: {
		"../knowledge/reference-value": ["referenceValue"],
		"../vocabulary/registry.generated": ["schemaTerm"],
		"../media/indexing.generated": ["mediaFragment", "mediaItem", "mediaRepresentation"],
	},
	tables: [
		{
			symbol: "mediaSelectionHead",
			name: "media_selection_head",
			meaning: "Versioned atomic publication of one sealed selection.",
			decision: "Versioned atomic publication of one sealed selection.",
			sourceTerms: ["http://www.w3.org/ns/prov#Activity"],
			columns: {
				slotId: {
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
			},
			constraints: [
				{
					kind: "foreign",
					name: "media_selection_head_slot_id_media_slot_id_fkey",
					columns: ["slotId"],
					table: "mediaSlot",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_selection_head_z9Ol7hFnwxu2_fkey",
					columns: ["slotId", "revisionId"],
					table: "mediaSelectionRevision",
					target: ["slotId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_selection_head_version",
					expression: "{version}>0",
				},
			],
		},
		{
			symbol: "mediaSelectionMember",
			name: "media_selection_member",
			meaning: "Ordered identified uses belong to the same subject/role and exact revision.",
			decision: "Ordered identified uses belong to the same subject/role and exact revision.",
			sourceTerms: ["http://www.w3.org/1999/02/22-rdf-syntax-ns#Seq"],
			columns: {
				slotId: {
					type: "uuid",
					required: true,
				},
				selectionRevisionId: {
					type: "uuid",
					required: true,
				},
				position: {
					type: "integer",
					required: true,
				},
				subjectRefId: {
					type: "uuid",
					required: true,
				},
				roleId: {
					type: "uuid",
					required: true,
				},
				useId: {
					type: "uuid",
					required: true,
				},
				useRevisionId: {
					type: "uuid",
					required: true,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["slotId", "selectionRevisionId", "position"],
				},
				{
					kind: "foreign",
					name: "media_selection_member_eX0Dhi4KsISB_fkey",
					columns: ["slotId", "selectionRevisionId"],
					table: "mediaSelectionRevision",
					target: ["slotId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_selection_member_XjWOLEEKZ3vF_fkey",
					columns: ["slotId", "subjectRefId", "roleId"],
					table: "mediaSlot",
					target: ["id", "subjectRefId", "roleId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_selection_member_fCbfQ8xN27Jz_fkey",
					columns: ["useId", "subjectRefId", "roleId"],
					table: "mediaUse",
					target: ["id", "subjectRefId", "roleId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_selection_member_90Ybw8HkgZet_fkey",
					columns: ["useId", "useRevisionId"],
					table: "mediaUseRevision",
					target: ["useId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_selection_position",
					expression: "{position} between 0 and 1023",
				},
			],
		},
		{
			symbol: "mediaSelectionRevision",
			name: "media_selection_revision",
			meaning:
				"A local selected set is staged then sealed; its cardinality is a reviewed product rule.",
			decision:
				"A local selected set is staged then sealed; its cardinality is a reviewed product rule.",
			sourceTerms: ["http://www.w3.org/ns/prov#Entity"],
			columns: {
				slotId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				sealed: {
					type: "boolean",
					required: true,
					defaultSql: "false",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["slotId", "id"],
				},
				{
					kind: "foreign",
					name: "media_selection_revision_slot_id_media_slot_id_fkey",
					columns: ["slotId"],
					table: "mediaSlot",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
			],
		},
		{
			symbol: "mediaSlot",
			name: "media_slot",
			meaning:
				"Subject, role, language and context define product cardinality; Schema.org multiplicity is not replaced globally.",
			decision:
				"Subject, role, language and context define product cardinality; Schema.org multiplicity is not replaced globally.",
			sourceTerms: ["https://schema.org/image"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				subjectRefId: {
					type: "uuid",
					required: true,
				},
				roleId: {
					type: "uuid",
					required: true,
				},
				language: {
					type: "text",
					required: true,
					defaultSql: "''",
				},
				contextKey: {
					type: "text",
					required: true,
					defaultSql: "''",
				},
				minimum: {
					type: "integer",
					required: true,
					defaultSql: "0",
				},
				maximum: {
					type: "integer",
					required: true,
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_slot_scope",
					columns: ["subjectRefId", "roleId", "language", "contextKey"],
				},
				{
					kind: "unique",
					name: "media_slot_subject_role",
					columns: ["id", "subjectRefId", "roleId"],
				},
				{
					kind: "foreign",
					name: "media_slot_subject_ref_id_reference_value_id_fkey",
					columns: ["subjectRefId"],
					table: "referenceValue",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_slot_role_id_schema_term_id_fkey",
					columns: ["roleId"],
					table: "schemaTerm",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_slot_cardinality",
					expression: "{minimum}>=0 and {maximum}>={minimum} and {maximum}<=1024",
				},
			],
		},
		{
			symbol: "mediaUse",
			name: "media_use",
			meaning:
				"Identified contextual use of an asset in a subject role; native subject identity remains independent.",
			decision:
				"Identified contextual use of an asset in a subject role; native subject identity remains independent.",
			sourceTerms: ["https://schema.org/image", "http://www.w3.org/ns/oa#hasTarget"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				subjectRefId: {
					type: "uuid",
					required: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				roleId: {
					type: "uuid",
					required: true,
				},
			},
			constraints: [
				{
					kind: "unique",
					name: "media_use_id_media",
					columns: ["id", "mediaId"],
				},
				{
					kind: "unique",
					name: "media_use_subject_role",
					columns: ["id", "subjectRefId", "roleId"],
				},
				{
					kind: "foreign",
					name: "media_use_subject_ref_id_reference_value_id_fkey",
					columns: ["subjectRefId"],
					table: "referenceValue",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_use_media_id_media_item_id_fkey",
					columns: ["mediaId"],
					table: "mediaItem",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_use_role_id_schema_term_id_fkey",
					columns: ["roleId"],
					table: "schemaTerm",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "index",
					name: "media_use_subject",
					columns: ["subjectRefId", "roleId", "id"],
				},
				{
					kind: "index",
					name: "media_use_media",
					columns: ["mediaId", "id"],
				},
			],
		},
		{
			symbol: "mediaUseRevision",
			name: "media_use_revision",
			meaning: "Exact representation/fragment and caption of a contextual use.",
			decision: "Exact representation/fragment and caption of a contextual use.",
			sourceTerms: ["http://www.w3.org/ns/oa#SpecificResource"],
			columns: {
				useId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				mediaId: {
					type: "uuid",
					required: true,
				},
				representationId: {
					type: "uuid",
				},
				fragmentId: {
					type: "uuid",
				},
				language: {
					type: "text",
				},
				caption: {
					type: "text",
				},
				sourceUri: {
					type: "text",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["useId", "id"],
				},
				{
					kind: "foreign",
					name: "media_use_revision_use_id_media_id_media_use_id_media_id_fkey",
					columns: ["useId", "mediaId"],
					table: "mediaUse",
					target: ["id", "mediaId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_use_revision_P40LGbDT6uER_fkey",
					columns: ["representationId", "mediaId"],
					table: "mediaRepresentation",
					target: ["id", "mediaId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "media_use_revision_TEwY5zsoPJFX_fkey",
					columns: ["fragmentId", "representationId"],
					table: "mediaFragment",
					target: ["id", "representationId"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "media_use_fragment_representation",
					expression: "{fragmentId} is null or {representationId} is not null",
				},
			],
		},
	],
};
