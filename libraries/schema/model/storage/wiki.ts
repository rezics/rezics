import type { StorageModule } from "../../src/model/contracts";
/** Reviewed native referents and storage invariants; generated Drizzle is output. */
export const storage: StorageModule = {
	key: "wiki",
	output: "src/postgres/wiki/pages.generated.ts",
	tableImports: {
		"../realms/realm": ["realm"],
		"../knowledge/reference-value": ["referenceValue"],
		"../identity/auth": ["users"],
	},
	tables: [
		{
			symbol: "wikiAddress",
			name: "wiki_address",
			meaning: "Namespace/language/path addressing is separate from page identity.",
			decision: "Namespace/language/path addressing is separate from page identity.",
			sourceTerms: ["http://purl.org/dc/terms/identifier"],
			columns: {
				namespace: {
					type: "text",
					required: true,
				},
				language: {
					type: "text",
					required: true,
				},
				path: {
					type: "text",
					required: true,
				},
				pageId: {
					type: "uuid",
					required: true,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["namespace", "language", "path"],
				},
				{
					kind: "foreign",
					name: "wiki_address_page_id_wiki_page_id_fkey",
					columns: ["pageId"],
					table: "wikiPage",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "index",
					name: "wiki_address_page",
					columns: ["pageId"],
				},
			],
		},
		{
			symbol: "wikiHead",
			name: "wiki_head",
			meaning: "Editing branch head has exact page/language/revision membership.",
			decision: "Editing branch head has exact page/language/revision membership.",
			sourceTerms: ["http://www.w3.org/ns/prov#Entity"],
			columns: {
				pageId: {
					type: "uuid",
					required: true,
				},
				language: {
					type: "text",
					required: true,
				},
				branch: {
					type: "text",
					required: true,
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
					kind: "primary",
					columns: ["pageId", "language", "branch"],
				},
				{
					kind: "foreign",
					name: "wiki_head_page_id_wiki_page_id_fkey",
					columns: ["pageId"],
					table: "wikiPage",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_head_iiHh6ZGX93gs_fkey",
					columns: ["pageId", "revisionId", "language"],
					table: "wikiRevision",
					target: ["pageId", "id", "language"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "wiki_head_version",
					expression: "{version}>0",
				},
			],
		},
		{
			symbol: "wikiLink",
			name: "wiki_link",
			meaning: "Exact revision link occurrence; an external IRI is not a native page identity.",
			decision: "Exact revision link occurrence; an external IRI is not a native page identity.",
			sourceTerms: ["http://purl.org/dc/terms/references"],
			columns: {
				pageId: {
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
				targetPageId: {
					type: "uuid",
				},
				externalIri: {
					type: "text",
				},
				selector: {
					type: "text",
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["pageId", "revisionId", "id"],
				},
				{
					kind: "foreign",
					name: "wiki_link_target_page_id_wiki_page_id_fkey",
					columns: ["targetPageId"],
					table: "wikiPage",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_link_page_id_revision_id_wiki_revision_page_id_id_fkey",
					columns: ["pageId", "revisionId"],
					table: "wikiRevision",
					target: ["pageId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "wiki_link_target",
					expression: "num_nonnulls({targetPageId},{externalIri})=1",
				},
				{
					kind: "index",
					name: "wiki_link_reverse",
					columns: ["targetPageId", "pageId"],
				},
			],
		},
		{
			symbol: "wikiPage",
			name: "wiki_page",
			meaning: "Wiki identity and locality are independent of forum and message storage.",
			decision: "Wiki identity and locality are independent of forum and message storage.",
			sourceTerms: ["https://schema.org/WebPage"],
			columns: {
				id: {
					type: "uuid",
					required: true,
					primary: true,
				},
				realmId: {
					type: "uuid",
				},
				subjectRefId: {
					type: "uuid",
				},
				state: {
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
					name: "wiki_page_realm_id_realm_id_fkey",
					columns: ["realmId"],
					table: "realm",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_page_subject_ref_id_reference_value_id_fkey",
					columns: ["subjectRefId"],
					table: "referenceValue",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "wiki_page_state",
					expression: "{state} in ('draft','published','withdrawn','erased')",
				},
				{
					kind: "index",
					name: "wiki_page_subject",
					columns: ["subjectRefId", "id"],
				},
			],
		},
		{
			symbol: "wikiRevision",
			name: "wiki_revision",
			meaning: "Immutable language-specific edit lineage; causal parent is not a timestamp guess.",
			decision: "Immutable language-specific edit lineage; causal parent is not a timestamp guess.",
			sourceTerms: ["http://www.w3.org/ns/prov#wasRevisionOf"],
			columns: {
				pageId: {
					type: "uuid",
					required: true,
				},
				id: {
					type: "uuid",
					required: true,
				},
				language: {
					type: "text",
					required: true,
				},
				parentId: {
					type: "uuid",
				},
				authorUserId: {
					type: "uuid",
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
					kind: "primary",
					columns: ["pageId", "id"],
				},
				{
					kind: "unique",
					name: "wiki_revision_language",
					columns: ["pageId", "id", "language"],
				},
				{
					kind: "foreign",
					name: "wiki_revision_page_id_wiki_page_id_fkey",
					columns: ["pageId"],
					table: "wikiPage",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_revision_author_user_id_users_id_fkey",
					columns: ["authorUserId"],
					table: "users",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_revision_9aF3c23VBELC_fkey",
					columns: ["pageId", "parentId", "language"],
					table: "wikiRevision",
					target: ["pageId", "id", "language"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "index",
					name: "wiki_revision_history",
					columns: ["pageId", "language", "createdAt", "id"],
				},
			],
		},
		{
			symbol: "wikiRevisionPayload",
			name: "wiki_revision_payload",
			meaning: "Erasable authored payload separated from retained editing identity.",
			decision: "Erasable authored payload separated from retained editing identity.",
			sourceTerms: ["http://purl.org/dc/terms/format", "https://schema.org/text"],
			columns: {
				pageId: {
					type: "uuid",
					required: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				title: {
					type: "text",
					required: true,
				},
				format: {
					type: "text",
					required: true,
				},
				body: {
					type: "jsonb",
					required: true,
					typeScript: "unknown",
				},
				digest: {
					type: "text",
					required: true,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["pageId", "revisionId"],
				},
				{
					kind: "foreign",
					name: "wiki_revision_payload_hmh4RXRzXWjG_fkey",
					columns: ["pageId", "revisionId"],
					table: "wikiRevision",
					target: ["pageId", "id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "wiki_payload_format",
					expression: "{format} in ('portable-text','markdown','plain-text')",
				},
			],
		},
		{
			symbol: "wikiSelection",
			name: "wiki_selection",
			meaning: "Reviewed publication selection is distinct from the latest edit.",
			decision: "Reviewed publication selection is distinct from the latest edit.",
			sourceTerms: ["http://www.w3.org/ns/prov#Activity"],
			columns: {
				pageId: {
					type: "uuid",
					required: true,
				},
				language: {
					type: "text",
					required: true,
				},
				revisionId: {
					type: "uuid",
					required: true,
				},
				version: {
					type: "bigint",
					required: true,
				},
				reviewedByUserId: {
					type: "uuid",
				},
				selectedAt: {
					type: "timestamp",
					required: true,
					defaultSql: "now()",
					precision: 3,
				},
			},
			constraints: [
				{
					kind: "primary",
					columns: ["pageId", "language"],
				},
				{
					kind: "foreign",
					name: "wiki_selection_page_id_wiki_page_id_fkey",
					columns: ["pageId"],
					table: "wikiPage",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_selection_reviewed_by_user_id_users_id_fkey",
					columns: ["reviewedByUserId"],
					table: "users",
					target: ["id"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "foreign",
					name: "wiki_selection_MuAbG64GbTwI_fkey",
					columns: ["pageId", "revisionId", "language"],
					table: "wikiRevision",
					target: ["pageId", "id", "language"],
					onDelete: "no action",
					onUpdate: "no action",
				},
				{
					kind: "check",
					name: "wiki_selection_version",
					expression: "{version}>0",
				},
			],
		},
	],
};
