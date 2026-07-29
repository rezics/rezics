import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { parse, type ParseResult } from "@babel/parser";
import { createProcessor } from "@mdx-js/mdx";
import type { ExportNamedDeclaration, File, ObjectExpression } from "@babel/types";
import type { Plugin } from "vite";

const productMetadataQuery = "product-metadata";
const productMetadataModulePrefix = "\0rezics-about-product-metadata:";
const productDocumentsModuleId = "virtual:rezics-about-product-documents";
const clientProductDocumentsPath = fileURLToPath(
	new URL("./productDocuments.client.ts", import.meta.url),
);
const serverProductDocumentsPath = fileURLToPath(
	new URL("./productDocuments.server.ts", import.meta.url),
);
const mdxProcessor = createProcessor();

function propertyName(property: ObjectExpression["properties"][number]): string {
	if (property.type !== "ObjectProperty" || property.computed) {
		throw new Error("Product metadata supports only plain object properties.");
	}
	if (property.key.type === "Identifier") return property.key.name;
	if (property.key.type === "StringLiteral") return property.key.value;
	throw new Error("Product metadata property names must be identifiers or strings.");
}

function readMetadataObject(expression: ObjectExpression): Record<string, string> {
	const metadata: Record<string, string> = {};
	for (const property of expression.properties) {
		const name = propertyName(property);
		if (property.type !== "ObjectProperty" || property.value.type !== "StringLiteral") {
			throw new Error(`Product metadata "${name}" must be a string literal.`);
		}
		if (Object.hasOwn(metadata, name)) {
			throw new Error(`Product metadata "${name}" is duplicated.`);
		}
		metadata[name] = property.value.value;
	}
	return metadata;
}

function metadataFromDeclaration(
	declaration: ExportNamedDeclaration["declaration"],
): Record<string, string> | undefined {
	if (declaration?.type !== "VariableDeclaration") return undefined;

	for (const variable of declaration.declarations) {
		if (variable.id.type !== "Identifier" || variable.id.name !== "metadata") continue;
		if (declaration.kind !== "const") {
			throw new Error('The "metadata" export must be declared with const.');
		}
		if (variable.init?.type !== "ObjectExpression") {
			throw new Error('The "metadata" export must be a plain object literal.');
		}
		return readMetadataObject(variable.init);
	}
	return undefined;
}

function parseModuleData(value: string): ParseResult<File> {
	return parse(value, { sourceType: "module" });
}

export function extractProductDocumentMetadata(
	source: string,
	sourcePath: string,
): Record<string, string> {
	const tree = mdxProcessor.parse(source);
	let metadata: Record<string, string> | undefined;

	for (const node of tree.children) {
		if (node.type !== "mdxjsEsm") continue;
		const moduleData = parseModuleData(node.value);
		for (const statement of moduleData.program.body) {
			if (statement.type !== "ExportNamedDeclaration") continue;
			const candidate = metadataFromDeclaration(statement.declaration);
			if (!candidate) continue;
			if (metadata) {
				throw new Error(`Product document exports metadata more than once: ${sourcePath}`);
			}
			metadata = candidate;
		}
	}

	if (!metadata) {
		throw new Error(`Product document has no metadata export: ${sourcePath}`);
	}
	return metadata;
}

export function productMetadataPlugin(): Plugin {
	return {
		name: "rezics-about-product-metadata",
		enforce: "pre",
		async resolveId(source, importer, options) {
			if (source === productDocumentsModuleId) {
				return options.ssr ? serverProductDocumentsPath : clientProductDocumentsPath;
			}

			const queryIndex = source.indexOf("?");
			if (queryIndex < 0) return;
			const query = new URLSearchParams(source.slice(queryIndex + 1));
			if (!query.has(productMetadataQuery)) return;

			const sourcePath = source.slice(0, queryIndex);
			const resolved = await this.resolve(sourcePath, importer, { skipSelf: true });
			if (!resolved) {
				throw new Error(`Unable to resolve product document metadata: ${source}`);
			}
			return productMetadataModulePrefix + resolved.id;
		},
		async load(id) {
			if (!id.startsWith(productMetadataModulePrefix)) return;
			const sourcePath = id.slice(productMetadataModulePrefix.length);
			const source = await readFile(sourcePath, "utf8");
			const metadata = extractProductDocumentMetadata(source, sourcePath);
			return `export default ${JSON.stringify(metadata)};`;
		},
	};
}
