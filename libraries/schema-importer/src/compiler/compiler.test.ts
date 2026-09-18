import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { BundleSchema } from "@rezics/schema";
import { nativeModels, operationalOwners } from "@rezics/schema/model-decisions/domains";
import { storageModules } from "@rezics/schema/model-decisions/storage";
import { applicationModel } from "@rezics/schema/model/generated";
import { compileOntology } from "./ontology";
import { compileModel, compileTraceability, emitShapes, shapeLoweringReport } from "./model";
import { emitDrizzle } from "./drizzle";
const bundle = BundleSchema.parse(
	JSON.parse(await readFile(new URL("../../registry/bundle.json", import.meta.url), "utf8")),
);
const ontology = compileOntology(bundle);
it("reproduces the complete standard IR and native model without provider contracts", async () => {
	expect(ontology).toEqual(
		JSON.parse(await readFile(new URL("../../registry/ontology.json", import.meta.url), "utf8")),
	);
	expect(compileModel(bundle, ontology, nativeModels, operationalOwners, storageModules)).toEqual(
		applicationModel,
	);
	const trace = compileTraceability(ontology, applicationModel);
	expect(trace).toHaveLength(
		bundle.releases.reduce((n, release) => n + release.definitions.length, 0),
	);
	expect(new Set(trace.map((row) => row.vocabulary))).not.toContain("musicbrainz");
	expect(trace.some((row) => row.disposition === "retained-vocabulary-definition")).toBe(true);
	for (const module of storageModules)
		expect(emitDrizzle(module)).toBe(
			await readFile(new URL(`../../../schema/${module.output}`, import.meta.url), "utf8"),
		);
});
it("a reviewed field change produces actual Drizzle storage and unknown source meanings fail", () => {
	const module = structuredClone(storageModules.find((module) => module.key === "wiki")!);
	const page = module.tables.find((table) => table.name === "wiki_page")!;
	page.columns.editorNote = { type: "text" };
	expect(emitDrizzle(module)).toContain('editorNote: text("editor_note")');
	const revised = compileModel(
		bundle,
		ontology,
		nativeModels,
		operationalOwners,
		storageModules.map((current) => (current.key === module.key ? module : current)),
	);
	expect(revised.storageDigest).not.toBe(applicationModel.storageDigest);
	expect(revised.id).not.toBe(applicationModel.id);
	const decisions = structuredClone(nativeModels);
	decisions[0]!.types[0]!.iri = "https://schema.org/NoSuchSelectedType";
	expect(() =>
		compileModel(bundle, ontology, decisions, operationalOwners, storageModules),
	).toThrow();
	const duplicate = structuredClone(nativeModels);
	duplicate[0]!.properties.push(duplicate[0]!.properties[0]!);
	expect(() =>
		compileModel(bundle, ontology, duplicate, operationalOwners, storageModules),
	).toThrow(/authority/);
});
it("keeps standard hints and expression nodes distinct from native constraints", () => {
	const author = ontology.definitions.find(
		(value) => value.iri === "https://schema.org/author" && value.vocabulary === "schemaorg",
	)!;
	expect(author.facets.suggestedRanges?.length).toBeGreaterThan(0);
	expect(author).not.toHaveProperty("maximum");
	expect(
		ontology.definitions.some((value) =>
			Object.values(value.facets)
				.flat()
				.some((value) => typeof value === "object" && value !== null && "nodeId" in value),
		),
	).toBe(true);
	expect(
		applicationModel.profiles
			.find((profile) => profile.key === "book-work")
			?.properties.find((rule) => rule.iri === "https://schema.org/author")?.storage.kind,
	).toBe("native-relation");
});
it("does not claim that the SHACL projection proves native occurrence or writer rules", () => {
	const shapes = emitShapes(applicationModel),
		report = shapeLoweringReport(applicationModel);
	expect(shapes).toContain("Advisory direct-triple projection");
	expect(shapes).not.toContain("sh:targetClass");
	expect(report.globalOmissions).toContain(
		"Relationship occurrence identity and duplicate endpoints",
	);
	expect(
		report.rules.some((rule) => rule.omissions.includes("Explicit native occurrence ordering")),
	).toBe(true);
});
