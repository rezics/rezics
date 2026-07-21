import { extname } from "node:path";

import { parse } from "@babel/parser";

const aboutLocaleByDirectory = {
	de: "de",
	en: "en",
	ja: "ja",
	ko: "ko",
	"zh-hans": "zh-Hans",
	"zh-hant": "zh-Hant",
};

function location(path, source, offset) {
	const prefix = source.slice(0, offset);
	const line = prefix.split("\n").length;
	const column = offset - prefix.lastIndexOf("\n");
	return `${path}:${line}:${column}`;
}

function isAsciiWordCharacter(value) {
	return /[A-Za-z0-9]/.test(value ?? "");
}

export function findTermOffset(value, term) {
	let offset = value.indexOf(term);
	while (offset >= 0) {
		const before = value[offset - 1];
		const after = value[offset + term.length];
		const startsWithAscii = isAsciiWordCharacter(term[0]);
		const endsWithAscii = isAsciiWordCharacter(term.at(-1));
		if (
			(!startsWithAscii || !isAsciiWordCharacter(before)) &&
			(!endsWithAscii || !isAsciiWordCharacter(after))
		)
			return offset;
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

function removeCodeAndLinks(value) {
	return [
		/```[\s\S]*?```/g,
		/`[^`]*`/g,
		/\{\{[^}]+\}\}/g,
		/\b(?:https?|mailto):\S+/gi,
		/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,
	].reduce(maskPattern, value);
}

function removeNonProse(value, verbatimDefinitions) {
	const withoutTerms = verbatimDefinitions.reduce(
		(text, definition) => maskTerm(text, definition.value),
		value,
	);
	return removeCodeAndLinks(withoutTerms);
}

function checkUnapprovedTokens(path, source, value, offset, verbatimDefinitions) {
	const prose = removeNonProse(value, verbatimDefinitions);
	const errors = [];
	for (const match of prose.matchAll(/[A-Za-z][A-Za-z0-9]*(?:[-_.:/][A-Za-z0-9]+)*/g)) {
		const token = match[0];
		if (token.length === 1) continue;
		errors.push(
			`${location(path, source, offset + (match.index ?? 0))} unapproved untranslated token ${JSON.stringify(token)}`,
		);
	}
	return errors;
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

export function localeForLocalizationPath(path) {
	const normalizedPath = path.replaceAll("\\", "/");
	const coreMatch = normalizedPath.match(/\/libraries\/i18n\/src\/languages\/(en|zh-Hant)\//);
	if (coreMatch) return coreMatch[1];
	const aboutMatch = normalizedPath.match(/\/apps\/about\/src\/content\/locales\/([^/]+)\//);
	return aboutMatch ? aboutLocaleByDirectory[aboutMatch[1]] : undefined;
}

export function flattenTerminology(terminology) {
	const canonicalByValue = new Map();
	const forbiddenByValue = new Map();
	for (const [concept, entry] of Object.entries(terminology)) {
		for (const [slot, value] of Object.entries(entry.forms)) {
			if (!canonicalByValue.has(value)) canonicalByValue.set(value, { concept, slot, value });
		}
		for (const value of entry.forbidden) {
			if (!forbiddenByValue.has(value)) forbiddenByValue.set(value, { concept, value });
		}
	}
	return {
		canonical: [...canonicalByValue.values()].toSorted(
			(left, right) => right.value.length - left.value.length,
		),
		forbidden: [...forbiddenByValue.values()].toSorted(
			(left, right) => right.value.length - left.value.length,
		),
	};
}

export function checkTerminologyRegistry(terminologyByLocale) {
	const errors = [];
	for (const [locale, terminology] of Object.entries(terminologyByLocale)) {
		const seenByValue = new Map();
		for (const [concept, entry] of Object.entries(terminology)) {
			for (const [slot, value] of Object.entries(entry.forms)) {
				if (value.trim().length === 0) {
					errors.push(`${locale}.${concept}.forms.${slot} must not be empty`);
					continue;
				}
				const otherConcept = seenByValue.get(value);
				if (otherConcept && otherConcept !== concept)
					errors.push(
						`${locale}.${concept}.forms.${slot} duplicates ${JSON.stringify(value)} from concept ${otherConcept}`,
					);
				seenByValue.set(value, concept);
			}
			const formValues = new Set(Object.values(entry.forms));
			for (const forbidden of entry.forbidden) {
				if (forbidden.trim().length === 0) {
					errors.push(`${locale}.${concept}.forbidden must not contain an empty value`);
					continue;
				}
				if (formValues.has(forbidden))
					errors.push(
						`${locale}.${concept}.forbidden duplicates approved form ${JSON.stringify(forbidden)}`,
					);
			}
		}
	}
	return errors;
}

function checkTerminologyValue(path, source, value, offset, terminologyDefinitions) {
	const errors = [];
	const prose = removeCodeAndLinks(value);
	for (const definition of terminologyDefinitions.forbidden) {
		const termOffset = findTermOffset(prose, definition.value);
		if (termOffset < 0) continue;
		errors.push(
			`${location(path, source, offset + termOffset)} forbidden ${definition.concept} terminology ${JSON.stringify(definition.value)}`,
		);
	}
	for (const definition of terminologyDefinitions.canonical) {
		const termOffset = findTermOffset(prose, definition.value);
		if (termOffset < 0) continue;
		errors.push(
			`${location(path, source, offset + termOffset)} use terminology.${definition.concept}.forms.${definition.slot} instead of duplicating ${JSON.stringify(definition.value)}`,
		);
	}
	return errors;
}

export function checkTypeScriptSource({
	path,
	source,
	verbatimDefinitions,
	terminologyDefinitions,
	rejectUnapprovedTokens,
}) {
	const errors = [];
	let sourceFile;
	try {
		sourceFile = parse(source, {
			sourceType: "module",
			plugins: extname(path) === ".tsx" ? ["typescript", "jsx"] : ["typescript"],
		});
	} catch (error) {
		return [`${path}: unable to parse localization source: ${error.message}`];
	}

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
			const valueOffset = (node.start ?? 0) + 1;
			for (const definition of verbatimDefinitions) {
				const termOffset = findTermOffset(value, definition.value);
				if (termOffset < 0) continue;
				errors.push(
					`${location(path, source, valueOffset + termOffset)} use verbatimTerms.${definition.key}.value instead of duplicating ${JSON.stringify(definition.value)}`,
				);
			}
			errors.push(
				...checkTerminologyValue(path, source, value, valueOffset, terminologyDefinitions),
			);
			if (rejectUnapprovedTokens)
				errors.push(
					...checkUnapprovedTokens(path, source, value, valueOffset, verbatimDefinitions),
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
	return errors;
}

export function checkMarkdownSource({
	path,
	source,
	verbatimDefinitions,
	terminologyDefinitions,
	rejectUnapprovedTokens,
}) {
	const errors = [];
	const prose = removeCodeAndLinks(source);
	for (const definition of terminologyDefinitions.forbidden) {
		let searchFrom = 0;
		while (searchFrom < prose.length) {
			const termOffset = findTermOffset(prose.slice(searchFrom), definition.value);
			if (termOffset < 0) break;
			const offset = searchFrom + termOffset;
			errors.push(
				`${location(path, source, offset)} forbidden ${definition.concept} terminology ${JSON.stringify(definition.value)}`,
			);
			searchFrom = offset + definition.value.length;
		}
	}
	if (rejectUnapprovedTokens)
		errors.push(...checkUnapprovedTokens(path, source, source, 0, verbatimDefinitions));
	for (const definition of verbatimDefinitions) {
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
	return errors;
}
