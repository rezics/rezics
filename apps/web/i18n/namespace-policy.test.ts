import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse, type ParserPlugin } from "@babel/parser";
import { describe, expect, it } from "vitest";

type AstNode = {
	readonly type: string;
	readonly loc?: { readonly start: { readonly line: number; readonly column: number } } | null;
	readonly [key: string]: unknown;
};

const WebRoot = fileURLToPath(new URL("..", import.meta.url));
const ResourceRegistryPath = resolve(WebRoot, "../../libraries/i18n/src/resources.ts");
const IgnoredDirectories = new Set([".next", ".vinext", "dist", "node_modules"]);
const SourceExtensions = new Set([".ts", ".tsx"]);
const SeededClientEntries = new Set(["native-i18n/next/seeded", "native-i18n/react/seeded"]);

function isAstNode(value: unknown): value is AstNode {
	return (
		value !== null &&
		typeof value === "object" &&
		"type" in value &&
		typeof value.type === "string"
	);
}

function nodeArray(value: unknown): readonly AstNode[] {
	return Array.isArray(value) ? value.filter(isAstNode) : [];
}

function identifierName(value: unknown): string | undefined {
	return isAstNode(value) && value.type === "Identifier" && typeof value.name === "string"
		? value.name
		: undefined;
}

function stringLiteralValue(value: unknown): string | undefined {
	return isAstNode(value) && value.type === "StringLiteral" && typeof value.value === "string"
		? value.value
		: undefined;
}

function location(path: string, node: AstNode): string {
	const start = node.loc?.start;
	return start ? `${path}:${start.line}:${start.column + 1}` : path;
}

function visit(value: unknown, visitor: (node: AstNode) => void): void {
	if (!isAstNode(value)) return;
	const node = value;
	visitor(node);
	for (const value of Object.values(node)) {
		if (Array.isArray(value)) {
			for (const child of value) if (isAstNode(child)) visit(child, visitor);
		} else if (isAstNode(value)) {
			visit(value, visitor);
		}
	}
}

function isLiteralNamespaceSelection(node: AstNode | undefined): boolean {
	if (!node) return false;
	if (node.type === "StringLiteral") return true;
	if (node.type !== "ArrayExpression") return false;
	if (!Array.isArray(node.elements) || node.elements.length === 0) return false;
	return node.elements.every((element) => isAstNode(element) && element.type === "StringLiteral");
}

function checkSource(path: string, source: string): string[] {
	const plugins: ParserPlugin[] = ["typescript"];
	if (extname(path) === ".tsx") plugins.push("jsx");
	const sourceFile = parse(source, { sourceType: "module", plugins });
	const hookNames = new Set<string>();
	const errors: string[] = [];

	visit(sourceFile, (node) => {
		if (node.type !== "ImportDeclaration") return;
		const sourceValue = stringLiteralValue(node.source);
		if (!sourceValue) return;

		if (SeededClientEntries.has(sourceValue))
			errors.push(
				`${location(path, node)} use the loader-backed client instead of ${JSON.stringify(sourceValue)}`,
			);

		if (sourceValue !== "@/i18n/client") return;
		for (const specifier of nodeArray(node.specifiers)) {
			if (
				specifier.type === "ImportSpecifier" &&
				identifierName(specifier.imported) === "useTranslation"
			) {
				const localName = identifierName(specifier.local);
				if (localName) hookNames.add(localName);
			}
		}
	});

	visit(sourceFile, (node) => {
		if (node.type !== "CallExpression") return;
		const calleeName = identifierName(node.callee);
		if (!calleeName || !hookNames.has(calleeName)) return;
		const selection = nodeArray(node.arguments)[0];
		if (isLiteralNamespaceSelection(selection)) return;
		errors.push(
			`${location(path, node)} declare a non-empty string or string-array literal directly in ${calleeName}(...)`,
		);
	});

	return errors;
}

function checkResourceRegistry(path: string, source: string): string[] {
	const sourceFile = parse(source, { sourceType: "module", plugins: ["typescript"] });
	const errors: string[] = [];

	visit(sourceFile, (node) => {
		if (node.type === "ImportDeclaration") {
			const sourceValue = stringLiteralValue(node.source);
			if (sourceValue === "server-only" || sourceValue?.startsWith("node:"))
				errors.push(
					`${location(path, node)} keep the translation resource registry client-safe`,
				);
		}

		if (
			node.type === "CallExpression" &&
			isAstNode(node.callee) &&
			node.callee.type === "Import"
		) {
			const sourceValue = stringLiteralValue(nodeArray(node.arguments)[0]);
			if (!sourceValue?.startsWith("./languages/"))
				errors.push(
					`${location(path, node)} use a statically analyzable translation-module import`,
				);
		}

		if (
			node.type === "MemberExpression" &&
			identifierName(node.object) === "process" &&
			identifierName(node.property) === "env"
		)
			errors.push(
				`${location(path, node)} do not read environment values in the client registry`,
			);
	});

	return errors;
}

async function collectSourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const entryPath = resolve(directory, entry.name);
			if (entry.isDirectory())
				return IgnoredDirectories.has(entry.name) ? [] : collectSourceFiles(entryPath);
			return SourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
		}),
	);
	return files.flat();
}

describe("i18n namespace policy", () => {
	it("accepts explicit consumer dependencies", () => {
		const errors = checkSource(
			"feature.tsx",
			'import { useTranslation as useI18n } from "@/i18n/client"; useI18n(["feed", "ui"]);',
		);

		expect(errors).toEqual([]);
	});

	it("rejects dynamic consumer dependencies and seeded clients", () => {
		const errors = checkSource(
			"feature.tsx",
			[
				'import { create } from "native-i18n/next/seeded";',
				'import { useTranslation } from "@/i18n/client";',
				'const namespaces = ["feed", "ui"] as const;',
				"useTranslation(namespaces);",
				"void create;",
			].join("\n"),
		);

		expect(errors).toHaveLength(2);
		expect(errors.join("\n")).toContain("loader-backed client");
		expect(errors.join("\n")).toContain("declare a non-empty string or string-array literal");
	});

	it("rejects server-only translation registries", () => {
		const errors = checkResourceRegistry(
			"resources.ts",
			[
				'import "server-only";',
				"const locale = process.env.DEFAULT_LOCALE;",
				"const load = (path: string) => import(path);",
				"void locale;",
				"void load;",
			].join("\n"),
		);

		expect(errors).toHaveLength(3);
		expect(errors.join("\n")).toContain("client-safe");
		expect(errors.join("\n")).toContain("environment values");
		expect(errors.join("\n")).toContain("statically analyzable");
	});

	it("keeps every web consumer dependency local and statically analyzable", async () => {
		const sourceFiles = await collectSourceFiles(WebRoot);
		const resourceRegistry = await readFile(ResourceRegistryPath, "utf8");
		const errors = (
			await Promise.all(
				sourceFiles.map(async (sourcePath) =>
					checkSource(relative(WebRoot, sourcePath), await readFile(sourcePath, "utf8")),
				),
			)
		)
			.flat()
			.concat(
				checkResourceRegistry(
					relative(resolve(WebRoot, "../.."), ResourceRegistryPath),
					resourceRegistry,
				),
			);

		expect(errors).toEqual([]);
	});
});
