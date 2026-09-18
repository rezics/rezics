import { parse } from "@babel/parser";
import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { SourceManifestSchema } from "@rezics/schema";
import { VocabularyRegistry } from "@rezics/schema/registry";
import { describeVocabularyClasses } from "@rezics/schema/profiles";
import { nativeModels, operationalOwners } from "@rezics/schema/model-decisions/domains";
import { storageModules } from "@rezics/schema/model-decisions/storage";
import { compileVocabularies } from "../readers/rdf";
import { compileOntology } from "./ontology";
import { compileModel, compileTraceability, emitShapes, shapeLoweringReport } from "./model";
import { emitDrizzle } from "./drizzle";

const root = fileURLToPath(new URL("../../", import.meta.url)),
	schemaRoot = resolve(root, "../schema");
const write = async (file: string, text: string) => {
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, text);
};
const json = async (file: string, value: unknown) =>
	write(file, JSON.stringify(value, null, "\t") + "\n");
/** @alpha Deterministic standards/model compilation. Storage target checks are generator admission guards, not runtime qualification. */
export async function generateNativeModel() {
	const manifest = SourceManifestSchema.parse(
		JSON.parse(await readFile(resolve(root, "sources/manifest.json"), "utf8")),
	);
	const bundle = await compileVocabularies(manifest, (file) =>
		readFile(resolve(root, "sources", file)),
	);
	const ontology = compileOntology(bundle),
		model = compileModel(bundle, ontology, nativeModels, operationalOwners, storageModules);
	if (new Set(storageModules.map((module) => module.output)).size !== storageModules.length)
		throw new TypeError("Duplicate generated storage owner");
	for (const module of storageModules) {
		if (!/^src\/postgres\/[a-z-]+\/[a-z-]+\.generated\.ts$/.test(module.output))
			throw new TypeError("Generated module escapes its storage owner");
		await write(resolve(schemaRoot, module.output), emitDrizzle(module));
	}
	const knownDomains = new Set(operationalOwners.map((owner) => owner.domain));
	for (const entry of await readdir(resolve(schemaRoot, "src/postgres"), { withFileTypes: true }))
		if (entry.isDirectory() && !knownDomains.has(entry.name))
			throw new TypeError(`Native domain needs an ownership decision: ${entry.name}`);
	// The emitter's source is the authored model. Native declarations are inspected only
	// to reject a mapping to absent storage, not used to invent semantic decisions.
	const production = await import("@rezics/schema/postgres"),
		tables = new Map<string, { columns: Set<string>; module: string }>();
	const seen = new Set<unknown>();
	const visit = (value: unknown) => {
		if (is(value, PgTable)) {
			const config = getTableConfig(value);
			tables.set(config.name, {
				columns: new Set(config.columns.map((column) => column.name)),
				module: "production Drizzle",
			});
			return;
		}
		if (value === null || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		Object.values(value).forEach(visit);
	};
	visit(production);
	for (const writer of model.writers) {
		if (
			!/^(?:libraries|services)\/[a-zA-Z0-9_./-]+\.ts$/.test(writer.module) ||
			writer.module.includes("..")
		)
			throw new TypeError("Invalid writer module");
		const source = await readFile(resolve(root, "../..", writer.module), "utf8");
		const ast = parse(source, { sourceType: "module", plugins: ["typescript"] });
		const exported = ast.program.body.some((node) => {
			if (writer.entry === "default") return node.type === "ExportDefaultDeclaration";
			if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") return false;
			const declaration = node.declaration;
			return declaration?.type === "FunctionDeclaration"
				? declaration.id?.name === writer.entry
				: declaration?.type === "VariableDeclaration" &&
						declaration.declarations.some(
							(item) => item.id.type === "Identifier" && item.id.name === writer.entry,
						);
		});
		if (!exported)
			throw new TypeError(`Declared writer entry is absent: ${writer.module}:${writer.entry}`);
	}
	for (const profile of model.profiles) {
		if (!tables.get(profile.identity.table)?.columns.has(profile.identity.id))
			throw new TypeError(`Model identity target missing: ${profile.key}`);
		for (const rule of profile.properties)
			for (const column of rule.storage.columns)
				if (!tables.get(rule.storage.table)?.columns.has(column))
					throw new TypeError(
						`Model storage target missing: ${profile.key}/${rule.iri} -> ${rule.storage.table}.${column}`,
					);
	}
	await json(resolve(root, "registry/bundle.json"), bundle);
	await json(resolve(root, "registry/ontology.json"), ontology);
	await json(resolve(root, "registry/model.json"), model);
	await json(resolve(root, "registry/traceability.json"), compileTraceability(ontology, model));
	await write(resolve(root, "registry/model.shacl.ttl"), emitShapes(model));
	await json(resolve(root, "registry/model-shacl-report.json"), shapeLoweringReport(model));
	await json(
		resolve(root, "registry/vocabulary-descriptions.json"),
		describeVocabularyClasses(new VocabularyRegistry(bundle)),
	);
	await write(
		resolve(schemaRoot, "src/generated/model.ts"),
		`// Generated by task libraries:schema-importer:generate. Do not edit.\nimport type { CompiledModel } from "../model/contracts";\nexport const applicationModel: CompiledModel = ${JSON.stringify(model, null, "\t")};\n`,
	);
	await json(resolve(root, "registry/model-coverage.json"), {
		modelId: model.id,
		ontologyDigest: ontology.digest,
		standards: ontology.vocabularies,
		definitions: ontology.definitions.length,
		reviewedProfiles: model.profiles.length,
		reviewedProperties: model.profiles.reduce((n, p) => n + p.properties.length, 0),
		generatedTables: model.generatedStorage.length,
		operationalDomains: model.operationalOwners.length,
		scope:
			"Standards/meaning preservation and named native storage/validation mappings; not whole-product workflow acceptance",
	});
	const report = [
		"# Reviewed native model and storage mappings",
		"",
		"Generated by `task libraries:schema-importer:generate`. Standard preservation, native validation and product workflow qualification are separate.",
		"",
		`Model: \`${model.id}\`. All native profiles name an explicit referent and single writer.`,
		"",
	];
	for (const profile of model.profiles) {
		report.push(
			`## ${profile.key}`,
			"",
			profile.grain,
			"",
			`Logical owner: \`${profile.owner}\`; identity storage: \`${profile.identity.table}\`. Locality: ${profile.locality.key}. ${profile.locality.growth}.`,
			"",
			"| Standard term | Relationship | Reason |",
			"| --- | --- | --- |",
			...profile.types.map((type) => `| ${type.iri} | ${type.relationship} | ${type.reason} |`),
			"",
			"| Property | Cardinality | Representation | Writer | Meaning |",
			"| --- | --- | --- | --- | --- |",
			...profile.properties.map(
				(rule) =>
					`| ${rule.iri} | ${rule.min}..${rule.max ?? "*"} | ${rule.storage.table} (${rule.storage.columns.join(", ")}) | ${rule.storage.writer} | ${rule.meaning} |`,
			),
			"",
		);
	}
	report.push(
		"## Authored operational owners",
		"",
		"| Domain | Authority | Reason |",
		"| --- | --- | --- |",
		...model.operationalOwners.map(
			(owner) => `| ${owner.domain} | ${owner.authority} | ${owner.reason} |`,
		),
		"",
		"## Generated Drizzle modules",
		"",
		"| Module | Table | Decision |",
		"| --- | --- | --- |",
		...model.generatedStorage.map(
			(table) => `| ${table.module} | ${table.table} | ${table.decision} |`,
		),
	);
	await write(resolve(schemaRoot, "docs/model.generated.md"), report.join("\n") + "\n");
	return { bundle, model, ontology };
}
