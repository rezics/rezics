import { z } from "zod";
import { DigestSchema, IriSchema } from "../contracts";

/** @alpha Authored SQL storage lowering, independent of any source provider's database. */
export interface ColumnModel {
	type:
		| "uuid"
		| "text"
		| "integer"
		| "bigint"
		| "numeric"
		| "boolean"
		| "timestamp"
		| "jsonb"
		| "bytes";
	name?: string;
	required?: boolean;
	primary?: boolean;
	defaultSql?: string;
	typeScript?: string;
	precision?: number;
	reference?: { table: string; column: string };
}
export type StorageConstraint =
	| { kind: "primary" | "unique"; name?: string; columns: string[] }
	| {
			kind: "foreign";
			name?: string;
			columns: string[];
			table: string;
			target: string[];
			onDelete?: "cascade" | "restrict" | "no action" | "set null";
			onUpdate?: "cascade" | "restrict" | "no action" | "set null";
	  }
	| { kind: "check"; name: string; expression: string }
	| { kind: "index"; name: string; columns: string[]; expressions?: string[]; where?: string };
export interface TableModel {
	symbol: string;
	name: string;
	meaning: string;
	decision: string;
	sourceTerms: string[];
	columns: Record<string, ColumnModel>;
	constraints: StorageConstraint[];
}
export interface StorageModule {
	key: string;
	output: string;
	factory?: { name: string; instances: { argument: string; exports: Record<string, string> }[] };
	typeImports?: Record<string, string[]>;
	tableImports?: Record<string, string[]>;
	tables: TableModel[];
}
export type ValueKind = "reference" | "iri" | "literal" | "unknown" | "no-value";
/** @alpha A reviewed rule declares one authoritative representation; source hints are retained separately. */
export interface PropertyDecision {
	iri: string;
	vocabulary: string;
	meaning: string;
	min: number;
	max: number | null;
	ordered: boolean;
	valueKinds: ValueKind[];
	datatypes?: string[];
	targetOwners?: string[];
	uniqueLanguage?: boolean;
	storage: {
		kind: "column" | "native-relation" | "semantic-relation" | "localized-value";
		table: string;
		columns: string[];
		writer: string;
		transform?: string;
	};
}
export interface NativeModelDecision {
	key: string;
	owner: string;
	grain: string;
	types: {
		iri: string;
		vocabulary: string;
		relationship: "exact" | "specialization" | "projection";
		reason: string;
	}[];
	identity: { table: string; id: string; requiresUniversalParent: false };
	properties: PropertyDecision[];
	additionalProperties: "descriptive-only" | "reject";
	locality: { key: string; growth: string; splitUnit: string; crossOwnerIntegrity: string };
}
export interface OperationalDecision {
	domain: string;
	authority: "native-operational" | "native-domain";
	reason: string;
	sourceModel: string;
}

const binding = z.strictObject({
	iri: IriSchema,
	termId: z.uuid(),
	definitionId: z.uuid(),
	releaseId: z.uuid(),
	vocabulary: z.string(),
	relationship: z.enum(["exact", "specialization", "projection"]),
	reason: z.string(),
});
const rule = z.strictObject({
	iri: IriSchema,
	vocabulary: z.string(),
	predicateId: z.uuid(),
	definitionId: z.uuid(),
	releaseId: z.uuid(),
	meaning: z.string(),
	min: z.number().int().nonnegative(),
	max: z.number().int().positive().nullable(),
	ordered: z.boolean(),
	valueKinds: z.array(z.enum(["reference", "iri", "literal", "unknown", "no-value"])).min(1),
	datatypes: z.array(IriSchema),
	targetOwners: z.array(z.string()),
	uniqueLanguage: z.boolean(),
	storage: z.strictObject({
		kind: z.enum(["column", "native-relation", "semantic-relation", "localized-value"]),
		table: z.string(),
		columns: z.array(z.string()).min(1),
		writer: z.string().min(1),
		transform: z.string().optional(),
	}),
});
/** @alpha Portable compiled decisions pin meaning and storage authority; they contain no table OIDs or shard addresses. */
export const CompiledModelSchema = z.strictObject({
	format: z.literal("rezics.application-model/1"),
	id: z.uuid(),
	digest: DigestSchema,
	ontologyDigest: DigestSchema,
	storageDigest: DigestSchema,
	sourceReleases: z.array(z.strictObject({ key: z.string(), id: z.uuid(), digest: DigestSchema })),
	profiles: z.array(
		z.strictObject({
			key: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
			owner: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/),
			grain: z.string().min(1),
			types: z.array(binding),
			identity: z.strictObject({
				table: z.string(),
				id: z.string(),
				requiresUniversalParent: z.literal(false),
			}),
			properties: z.array(rule),
			additionalProperties: z.enum(["descriptive-only", "reject"]),
			locality: z.strictObject({
				key: z.string(),
				growth: z.string(),
				splitUnit: z.string(),
				crossOwnerIntegrity: z.string(),
			}),
		}),
	),
	operationalOwners: z.array(
		z.strictObject({
			domain: z.string(),
			authority: z.enum(["native-operational", "native-domain"]),
			reason: z.string(),
			sourceModel: z.string(),
		}),
	),
	writers: z.array(
		z.strictObject({
			key: z.string(),
			kind: z.enum(["command", "route", "storage-contract"]),
			module: z.string(),
			entry: z.string(),
			tablePattern: z.string(),
			representations: z.array(z.string()),
		}),
	),
	generatedStorage: z.array(
		z.strictObject({
			symbol: z.string(),
			table: z.string(),
			module: z.string(),
			meaning: z.string(),
			decision: z.string(),
			sourceTerms: z.array(IriSchema),
		}),
	),
});
export type CompiledModel = z.infer<typeof CompiledModelSchema>;
