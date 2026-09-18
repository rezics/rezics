import { storage as media_index } from "./storage/media-index";
import { storage as media_selection } from "./storage/media-selection";
import { storage as wiki } from "./storage/wiki";
import { storage as descriptions } from "./storage/descriptions";
import type {
	ColumnModel,
	StorageModule,
	StorageConstraint,
	TableModel,
} from "../src/model/contracts";
const ns = {
	rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
	rdfs: "http://www.w3.org/2000/01/rdf-schema#",
	owl: "http://www.w3.org/2002/07/owl#",
	prov: "http://www.w3.org/ns/prov#",
	skos: "http://www.w3.org/2004/02/skos/core#",
	sh: "http://www.w3.org/ns/shacl#",
};
const col = (type: ColumnModel["type"], extra: Partial<ColumnModel> = {}): ColumnModel => ({
	type,
	required: true,
	...extra,
});
const id = () => col("uuid", { primary: true });
const ref = (table: string, column = "id") => col("uuid", { reference: { table, column } });
const text = () => col("text");
const json = (typeScript: string) => col("jsonb", { typeScript });
const instant = () => col("timestamp", { defaultSql: "now()", precision: 3 });
const version = () => col("bigint");
const unique = (name: string, ...columns: string[]): StorageConstraint => ({
	kind: "unique",
	name,
	columns,
});
const primary = (...columns: string[]): StorageConstraint => ({ kind: "primary", columns });
const check = (name: string, expression: string): StorageConstraint => ({
	kind: "check",
	name,
	expression,
});
const index = (name: string, ...columns: string[]): StorageConstraint => ({
	kind: "index",
	name,
	columns,
});
const foreign = (columns: string[], table: string, ...target: string[]): StorageConstraint => ({
	kind: "foreign",
	columns,
	table,
	target,
});
const table = (
	symbol: string,
	name: string,
	meaning: string,
	sourceTerms: string[],
	columns: TableModel["columns"],
	constraints: StorageConstraint[] = [],
	decision = "Replicated vocabulary metadata; identity, meaning, labels and selection have independent lifecycles.",
): TableModel => ({ symbol, name, meaning, decision, sourceTerms, columns, constraints });

/** Reviewed vocabulary storage. Standards supply meaning; bytes, revisions and indexes are explicit REZICS decisions. */
export const vocabularyStorage: StorageModule = {
	key: "vocabulary",
	output: "src/postgres/vocabulary/registry.generated.ts",
	typeImports: { "../../contracts": ["VocabularySource"] },
	tables: [
		table(
			"schemaVocabulary",
			"schema_vocabulary",
			"A vocabulary identity independent of content objects.",
			[ns.owl + "Ontology"],
			{ id: id(), key: text() },
			[
				unique("schema_vocabulary_key", "key"),
				check("schema_vocabulary_key_shape", "{key} ~ '^[a-z][a-z0-9-]{0,63}$'"),
			],
		),
		table(
			"schemaRelease",
			"schema_release",
			"Exact vocabulary release, canonical graph and original artifact.",
			[ns.owl + "Ontology", ns.prov + "Entity"],
			{
				id: id(),
				vocabularyId: ref("schemaVocabulary"),
				version: text(),
				digest: text(),
				source: json("VocabularySource"),
				sourceBytes: col("bytes"),
				canonical: text(),
				createdAt: instant(),
			},
			[
				unique("schema_release_vocabulary_id", "id", "vocabularyId"),
				unique("schema_release_content", "vocabularyId", "digest"),
				check("schema_release_digest_shape", "{digest} ~ '^[0-9a-f]{64}$'"),
				check(
					"schema_release_source_bound",
					"octet_length({sourceBytes}) <= 16777216 and jsonb_typeof({source}) = 'object'",
				),
				check(
					"schema_release_source_digest",
					"coalesce(encode(sha256({sourceBytes}), 'hex') = {source}->>'sha256', false)",
				),
			],
		),
		table(
			"schemaReleaseContext",
			"schema_release_context",
			"Pinned JSON-LD context bytes for offline interpretation.",
			[ns.prov + "Entity"],
			{ releaseId: ref("schemaRelease"), sha256: text(), bytes: col("bytes") },
			[
				primary("releaseId", "sha256"),
				check(
					"schema_release_context_bound",
					"octet_length({bytes}) <= 1048576 and encode(sha256({bytes}), 'hex') = {sha256}",
				),
			],
		),
		table(
			"schemaVocabularyHead",
			"schema_vocabulary_head",
			"Explicit adopted release; import does not select it.",
			[ns.prov + "wasRevisionOf"],
			{
				vocabularyId: { ...ref("schemaVocabulary"), primary: true },
				releaseId: col("uuid"),
				version: version(),
			},
			[
				foreign(["releaseId", "vocabularyId"], "schemaRelease", "id", "vocabularyId"),
				check("schema_vocabulary_head_version", "{version} between 1 and 9007199254740991"),
			],
		),
		table(
			"schemaTerm",
			"schema_term",
			"Stable term IRI and UUID; long IRIs use bounded digest indexes.",
			[ns.rdfs + "Resource"],
			{ id: id(), iri: text(), iriHash: text() },
			[
				unique("schema_term_iri_hash", "iriHash"),
				check(
					"schema_term_iri_bounds",
					"octet_length({iri}) between 1 and 262144 and encode(sha256(convert_to({iri}, 'UTF8')), 'hex') = {iriHash}",
				),
			],
		),
		table(
			"schemaTermAlias",
			"schema_term_alias",
			"Only reviewed identity aliases; sameAs is not an automatic merge.",
			[ns.owl + "sameAs"],
			{ iriHash: col("text", { primary: true }), iri: text(), termId: ref("schemaTerm") },
			[
				index("schema_term_alias_term", "termId"),
				check(
					"schema_term_alias_hash",
					"encode(sha256(convert_to({iri}, 'UTF8')), 'hex') = {iriHash}",
				),
			],
		),
		table(
			"schemaDefinition",
			"schema_definition",
			"Immutable meaning excludes display translations.",
			[ns.rdfs + "Class", ns.rdf + "Property"],
			{
				id: id(),
				termId: ref("schemaTerm"),
				vocabularyId: ref("schemaVocabulary"),
				digest: text(),
				canonical: text(),
				types: json("string[]"),
				status: col("text", { typeScript: '"active" | "pending" | "retired"' }),
				replacements: json("string[]"),
			},
			[
				unique("schema_definition_term_id", "id", "termId"),
				unique("schema_definition_origin", "id", "termId", "vocabularyId"),
				unique("schema_definition_content", "termId", "vocabularyId", "digest"),
				check(
					"schema_definition_shape",
					"{digest} ~ '^[0-9a-f]{64}$' and {status} in ('active','pending','retired') and jsonb_typeof({types}) = 'array' and jsonb_typeof({replacements}) = 'array'",
				),
			],
		),
		table(
			"schemaReleaseTerm",
			"schema_release_term",
			"Exact term definition membership for each release.",
			[ns.rdfs + "isDefinedBy"],
			{
				releaseId: col("uuid"),
				vocabularyId: col("uuid"),
				termId: col("uuid"),
				definitionId: col("uuid"),
			},
			[
				primary("releaseId", "termId"),
				foreign(["releaseId", "vocabularyId"], "schemaRelease", "id", "vocabularyId"),
				foreign(
					["definitionId", "termId", "vocabularyId"],
					"schemaDefinition",
					"id",
					"termId",
					"vocabularyId",
				),
				index("schema_release_term_reverse", "termId", "releaseId"),
			],
		),
		table(
			"schemaLabel",
			"schema_label",
			"Original literal labels; definition identity is independent.",
			[ns.rdfs + "label", ns.skos + "prefLabel", ns.skos + "altLabel"],
			{
				id: id(),
				termId: ref("schemaTerm"),
				predicate: text(),
				value: text(),
				language: text(),
				datatype: text(),
			},
			[
				unique("schema_label_term_language", "id", "termId", "language"),
				unique("schema_label_term", "id", "termId"),
				index("schema_label_locale", "termId", "language", "id"),
			],
		),
		table(
			"schemaReleaseLabel",
			"schema_release_label",
			"Keep all upstream label alternatives and their release context.",
			[ns.rdfs + "label"],
			{ releaseId: col("uuid"), termId: col("uuid"), labelId: col("uuid") },
			[
				primary("releaseId", "termId", "labelId"),
				foreign(["releaseId", "termId"], "schemaReleaseTerm", "releaseId", "termId"),
				foreign(["labelId", "termId"], "schemaLabel", "id", "termId"),
			],
		),
		table(
			"schemaChange",
			"schema_change",
			"Shared edit identity; evidence and annotations target the same edit.",
			[ns.prov + "Activity"],
			{
				id: id(),
				actor: col("jsonb", {
					required: false,
					typeScript: "{ owner: string; id: string } | null",
				}),
				message: text(),
				createdAt: instant(),
			},
			[
				check("schema_change_message_bound", "octet_length({message}) between 1 and 16384"),
				check(
					"schema_change_actor",
					"{actor} is null or coalesce(jsonb_typeof({actor}) = 'object' and {actor}->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$' and {actor}->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', false)",
				),
			],
		),
		table(
			"schemaLabelSelection",
			"schema_label_selection",
			"Append-only translation selection, independent from meaning.",
			[ns.prov + "wasGeneratedBy", ns.rdfs + "label"],
			{
				id: id(),
				termId: ref("schemaTerm"),
				language: text(),
				labelId: col("uuid"),
				version: version(),
				changeId: ref("schemaChange"),
				createdAt: instant(),
			},
			[
				foreign(["labelId", "termId", "language"], "schemaLabel", "id", "termId", "language"),
				unique("schema_label_selection_version", "termId", "language", "version"),
				index("schema_label_selection_latest", "termId", "language", "version:desc"),
				check(
					"schema_label_selection_version_positive",
					"{version} between 1 and 9007199254740991",
				),
			],
		),
	],
};

/** Selected application-model snapshots are replicated metadata, never content identity parents. */
export const modelStorage: StorageModule = {
	key: "application-model",
	output: "src/postgres/vocabulary/model.generated.ts",
	typeImports: { "../../model/contracts": ["CompiledModel"] },
	tableImports: { "./registry.generated": ["schemaDefinition", "schemaReleaseTerm"] },
	tables: [
		table(
			"schemaModelRelease",
			"schema_model_release",
			"Content-addressed reviewed model with its complete lowering decisions.",
			[ns.sh + "NodeShape", ns.prov + "Entity"],
			{
				id: id(),
				digest: text(),
				ontologyDigest: text(),
				body: json("CompiledModel"),
				createdAt: instant(),
			},
			[
				unique("schema_model_release_digest", "digest"),
				check(
					"schema_model_release_shape",
					"{digest} ~ '^[0-9a-f]{64}$' and {ontologyDigest} ~ '^[0-9a-f]{64}$' and jsonb_typeof({body})='object'",
				),
			],
		),
		table(
			"schemaModelProfile",
			"schema_model_profile",
			"A compiled profile is an exact member of its reviewed model release.",
			[ns.sh + "NodeShape"],
			{
				modelId: ref("schemaModelRelease"),
				key: text(),
				owner: text(),
				body: json('CompiledModel["profiles"][number]'),
			},
			[
				primary("modelId", "key"),
				check("schema_model_profile_body", "jsonb_typeof({body})='object'"),
			],
		),
		table(
			"schemaModelBinding",
			"schema_model_binding",
			"Indexed exact standard-definition dependencies of the selected model.",
			[ns.rdfs + "isDefinedBy"],
			{
				modelId: ref("schemaModelRelease"),
				profileKey: text(),
				termId: col("uuid"),
				definitionId: col("uuid"),
				releaseId: col("uuid"),
				role: col("text", { typeScript: '"type" | "property"' }),
			},
			[
				primary("modelId", "profileKey", "termId", "role"),
				foreign(["modelId", "profileKey"], "schemaModelProfile", "modelId", "key"),
				foreign(["definitionId", "termId"], "schemaDefinition", "id", "termId"),
				foreign(["releaseId", "termId"], "schemaReleaseTerm", "releaseId", "termId"),
				check("schema_model_binding_role", "{role} in ('type','property')"),
			],
		),
		table(
			"schemaModelHead",
			"schema_model_head",
			"Explicit compare-and-set model adoption; compilation never selects itself.",
			[ns.prov + "wasRevisionOf"],
			{
				key: col("text", { primary: true }),
				modelId: ref("schemaModelRelease"),
				version: version(),
			},
			[check("schema_model_head_version", "{version} between 1 and 9007199254740991")],
		),
	],
};

/** A relation occurrence is an object; a predicate remains a separately identified, translated term. */
export const relationStorage: StorageModule = {
	key: "identified-relations",
	output: "src/postgres/knowledge/semantic-relations.generated.ts",
	factory: {
		name: "defineRelationTables",
		instances: [
			{
				argument: "schema",
				exports: {
					schemaRelation: "relation",
					schemaRelationRevision: "revision",
					schemaRelationSelection: "selection",
				},
			},
		],
	},
	typeImports: { "../../contracts": ["SemanticValue"] },
	tableImports: {
		"../vocabulary/registry.generated": ["schemaChange", "schemaDefinition"],
		"../vocabulary/model.generated": ["schemaModelProfile"],
	},
	tables: [
		table(
			"relation",
			"$family_relation",
			"Stable occurrence identity independent of endpoints and physical placement.",
			[ns.rdf + "Statement"],
			{ id: id(), subjectOwner: text(), subjectId: col("uuid"), createdAt: instant() },
			[
				index("$family_relation_subject", "subjectOwner", "subjectId", "id"),
				check("$family_relation_owner", "{subjectOwner} ~ '^[a-z][a-z0-9_.-]{0,95}$'"),
			],
			"A family is local to a workload. Logical references do not encode its prefix; endpoints are validated by the owning writer.",
		),
		table(
			"revision",
			"$family_relation_revision",
			"Exact immutable predicate meaning, value and edit evidence.",
			[ns.rdf + "Statement", ns.prov + "wasRevisionOf"],
			{
				id: id(),
				relationId: ref("relation"),
				modelId: col("uuid", { required: false }),
				profileKey: col("text", { required: false }),
				predicateId: col("uuid"),
				definitionId: col("uuid"),
				subjectRevisionId: col("uuid", { required: false }),
				parentRevisionId: col("uuid", { required: false }),
				changeId: ref("schemaChange"),
				value: json("SemanticValue"),
				position: col("numeric", { required: false }),
				digest: text(),
				createdAt: instant(),
			},
			[
				unique("$family_revision_relation", "id", "relationId"),
				foreign(["modelId", "profileKey"], "schemaModelProfile", "modelId", "key"),
				check("$family_revision_model_context", "num_nonnulls({modelId},{profileKey}) in (0,2)"),
				foreign(["definitionId", "predicateId"], "schemaDefinition", "id", "termId"),
				foreign(["parentRevisionId", "relationId"], "revision", "id", "relationId"),
				index("$family_revision_history", "relationId", "createdAt", "id"),
				index("$family_revision_predicate", "predicateId", "relationId", "id"),
				{
					kind: "index",
					name: "$family_revision_target",
					columns: [],
					expressions: [
						"({value}->'reference'->>'owner')",
						"({value}->'reference'->>'id')",
						"{predicateId}",
						"{id}",
					],
					where: "{value}->>'kind' = 'reference'",
				},
				check(
					"$family_revision_shape",
					"{digest} ~ '^[0-9a-f]{64}$' and ({position} is null or ({position} >= 0 and {position} < 1e40 and scale({position}) = 0)) and jsonb_typeof({value}) = 'object' and {value}->>'kind' in ('reference','iri','literal','unknown','no-value')",
				),
				check(
					"$family_revision_not_self_parent",
					"{parentRevisionId} is null or {parentRevisionId} <> {id}",
				),
				check(
					"$family_revision_value",
					"coalesce(octet_length({value}::text) <= 524288 and case {value}->>'kind'\n\t\t\twhen 'reference' then jsonb_typeof({value}->'reference') = 'object'\n\t\t\t\tand {value}->'reference'->>'owner' ~ '^[a-z][a-z0-9_.-]{0,95}$'\n\t\t\t\tand {value}->'reference'->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'\n\t\t\t\tand (not ({value}->'reference' ? 'revisionId') or {value}->'reference'->>'revisionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')\n\t\t\twhen 'iri' then jsonb_typeof({value}->'iri') = 'string' and {value}->>'iri' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'\n\t\t\twhen 'literal' then jsonb_typeof({value}->'value') = 'string' and jsonb_typeof({value}->'datatype') = 'string'\n\t\t\t\tand {value}->>'datatype' ~ '^[A-Za-z][A-Za-z0-9+.-]*:'\n\t\t\t\tand ({value}->>'datatype' = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString') = ({value} ? 'language')\n\t\t\t\tand (not ({value} ? 'language') or {value}->>'language' ~* '^[a-z]+(-[a-z0-9]+)*$')\n\t\t\twhen 'unknown' then true when 'no-value' then true else false end, false)",
				),
			],
			"Values preserve exact lexical strings. Native constraints are explicit model rules, not inferred from range/domain hints.",
		),
		table(
			"selection",
			"$family_relation_selection",
			"Append-only adoption or retraction with a compare-and-set version.",
			[ns.prov + "Activity"],
			{
				id: id(),
				relationId: ref("relation"),
				revisionId: col("uuid", { required: false }),
				version: version(),
				changeId: ref("schemaChange"),
				createdAt: instant(),
			},
			[
				foreign(["revisionId", "relationId"], "revision", "id", "relationId"),
				unique("$family_selection_version", "relationId", "version"),
				index("$family_selection_latest", "relationId", "version:desc"),
				check("$family_selection_version_positive", "{version} between 1 and 9007199254740991"),
			],
		),
	],
};
export const storageModules = [
	vocabularyStorage,
	modelStorage,
	relationStorage,
	media_index,
	media_selection,
	wiki,
	descriptions,
];
