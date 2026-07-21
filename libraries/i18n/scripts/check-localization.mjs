import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "@babel/parser";

import { verbatimTerms } from "../src/verbatim-terms.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const repositoryRoot = resolve(packageRoot, "../..");
const sourceRoots = [
	resolve(packageRoot, "src/languages/en"),
	resolve(packageRoot, "src/languages/zh-Hant"),
	resolve(repositoryRoot, "apps/about/src/content/locales"),
];
const sourceExtensions = new Set([".ts", ".tsx", ".md", ".mdx"]);
const definitions = Object.entries(verbatimTerms).toSorted(
	([, left], [, right]) => right.value.length - left.value.length,
);
const errors = [];

async function collectFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(
		entries.map((entry) => {
			const path = resolve(directory, entry.name);
			return entry.isDirectory() ? collectFiles(path) : path;
		}),
	);
	return files.flat().filter((path) => sourceExtensions.has(extname(path)));
}

function location(path, source, offset) {
	const prefix = source.slice(0, offset);
	const line = prefix.split("\n").length;
	const column = offset - prefix.lastIndexOf("\n");
	return `${relative(repositoryRoot, path)}:${line}:${column}`;
}

function definitionsForPath(path) {
	return definitions.filter(([, definition]) =>
		definition.scope === "about" ? path.includes("/apps/about/") : true,
	);
}

function findTermOffset(value, term) {
	let offset = value.indexOf(term);
	while (offset >= 0) {
		const before = value[offset - 1];
		const after = value[offset + term.length];
		if (!/[A-Za-z0-9]/.test(before ?? "") && !/[A-Za-z0-9]/.test(after ?? "")) return offset;
		offset = value.indexOf(term, offset + 1);
	}
	return -1;
}

function maskTerm(value, term) {
	let output = value;
	let searchFrom = 0;
	while (searchFrom < output.length) {
		const relativeOffset = findTermOffset(output.slice(searchFrom), term);
		if (relativeOffset < 0) break;
		const offset = searchFrom + relativeOffset;
		output = `${output.slice(0, offset)}${" ".repeat(term.length)}${output.slice(offset + term.length)}`;
		searchFrom = offset + term.length;
	}
	return output;
}

function maskPattern(value, pattern) {
	return value.replace(pattern, (match) => " ".repeat(match.length));
}

function removeNonProse(value, applicableDefinitions) {
	const withoutTerms = applicableDefinitions.reduce(
		(text, [, definition]) => maskTerm(text, definition.value),
		value,
	);
	return [
		/```[\s\S]*?```/g,
		/`[^`]*`/g,
		/\{\{[^}]+\}\}/g,
		/\b(?:https?|mailto):\S+/gi,
		/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
	].reduce(maskPattern, withoutTerms);
}

function checkUnapprovedTokens(path, source, value, offset, applicableDefinitions) {
	const prose = removeNonProse(value, applicableDefinitions);
	for (const match of prose.matchAll(/[A-Za-z][A-Za-z0-9]*(?:[-_.:/][A-Za-z0-9]+)*/g)) {
		const token = match[0];
		if (token.length === 1) continue;
		errors.push(
			`${location(path, source, offset + (match.index ?? 0))} unapproved untranslated token ${JSON.stringify(token)}`,
		);
	}
}

function isModuleSpecifier(node, parent) {
	return (
		(parent?.type === "ImportDeclaration" ||
			parent?.type === "ExportNamedDeclaration" ||
			parent?.type === "ExportAllDeclaration" ||
			parent?.type === "TSImportType") &&
		(parent.source === node || parent.argument === node)
	);
}

function isPropertyName(node, parent) {
	return (
		(parent?.type === "ObjectProperty" ||
			parent?.type === "ObjectMethod" ||
			parent?.type === "ClassProperty" ||
			parent?.type === "ClassMethod") &&
		parent.key === node
	);
}

function checkTypeScript(path, source) {
	const rejectUnapprovedTokens = path.includes("/zh-Hant/") || path.includes("/zh-hant/");
	const applicableDefinitions = definitionsForPath(path);
	const sourceFile = parse(source, {
		sourceType: "module",
		plugins: extname(path) === ".tsx" ? ["typescript", "jsx"] : ["typescript"],
	});

	function visit(node, parent) {
		if (!node || typeof node !== "object") return;
		const value =
			node.type === "StringLiteral"
				? node.value
				: node.type === "TemplateElement"
					? node.value.cooked
					: undefined;
		if (
			typeof value === "string" &&
			!isModuleSpecifier(node, parent) &&
			!isPropertyName(node, parent)
		) {
			for (const [key, definition] of applicableDefinitions) {
				const termOffset = findTermOffset(value, definition.value);
				if (termOffset < 0) continue;
				errors.push(
					`${location(path, source, (node.start ?? 0) + 1 + termOffset)} use verbatimTerms.${key}.value instead of duplicating ${JSON.stringify(definition.value)}`,
				);
			}
			if (rejectUnapprovedTokens)
				checkUnapprovedTokens(
					path,
					source,
					value,
					(node.start ?? 0) + 1,
					applicableDefinitions,
				);
		}

		for (const child of Object.values(node)) {
			if (Array.isArray(child)) {
				for (const item of child) visit(item, node);
			} else {
				visit(child, node);
			}
		}
	}

	visit(sourceFile, undefined);
}

function checkMarkdown(path, source) {
	const applicableDefinitions = definitionsForPath(path);
	if (path.includes("/zh-Hant/") || path.includes("/zh-hant/"))
		checkUnapprovedTokens(path, source, source, 0, applicableDefinitions);
	for (const [, definition] of applicableDefinitions) {
		const canonical = definition.value;
		const lowerCanonical = canonical.toLocaleLowerCase("en-US");
		for (const match of source.matchAll(/[A-Za-z][A-Za-z0-9]*(?:[-_.][A-Za-z0-9]+)*/g)) {
			const token = match[0];
			if (token === canonical || token.toLocaleLowerCase("en-US") !== lowerCanonical)
				continue;
			errors.push(
				`${location(path, source, match.index ?? 0)} use canonical spelling ${JSON.stringify(canonical)} instead of ${JSON.stringify(token)}`,
			);
		}
	}
}

for (const path of (await Promise.all(sourceRoots.map(collectFiles))).flat().toSorted()) {
	const source = await readFile(path, "utf8");
	if (path.endsWith(".ts") || path.endsWith(".tsx")) checkTypeScript(path, source);
	else checkMarkdown(path, source);
}

if (errors.length > 0) {
	console.error("Localization policy violations:\n");
	console.error(errors.map((error) => `- ${error}`).join("\n"));
	process.exitCode = 1;
}
