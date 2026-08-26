import { createHash } from "node:crypto";

import {
	ZoneBlockStylingContractRegistry,
	ZoneStylingContract,
	ZoneStylingContractStateAttributeValues,
} from "@rezics/block";
import {
	generate,
	lexer,
	parse,
	walk,
	type AttributeSelector,
	type CssNode,
	type Declaration,
	type Rule,
	type Selector,
} from "css-tree";

export const MaximumZoneThemeStylesheetBytes = 64 * 1_024;
export const MaximumZoneThemeRules = 256;
export const MaximumZoneThemeSelectors = 512;
export const MaximumZoneThemeDeclarations = 2_048;
export const MaximumZoneThemeSelectorComponents = 32;

const ThemeScopeSelector = "[data-zone-theme-scope]";
const ThemeAssetUrl =
	/^\/image-assets\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\/content$/;
const StyleRolePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
// Cascade layers and keyframe names have document-global effects, so they are
// excluded even though every ordinary selector is scope-prefixed.
const AllowedAtRules = new Set(["container", "media", "supports"]);
const AllowedPseudoClasses = new Set([
	"active",
	"checked",
	"disabled",
	"empty",
	"first-child",
	"focus",
	"focus-visible",
	"focus-within",
	"hover",
	"last-child",
	"nth-child",
	"nth-last-child",
	"only-child",
]);
const AllowedPseudoElements = new Set(["after", "before"]);
const AllowedAttributeNames = new Set([
	...ZoneStylingContract.rootAttributes,
	...ZoneStylingContractStateAttributeValues,
	"data-part",
	"data-zone-surface",
]);
const AllowedBlockTypes: ReadonlySet<string> = new Set(ZoneStylingContract.blockTypes);
const AllowedParts: ReadonlySet<string> = new Set(
	Object.values(ZoneBlockStylingContractRegistry).flatMap(({ parts }) => parts),
);
const AllowedStateValues = new Map<string, Set<string>>();
for (const contract of Object.values(ZoneBlockStylingContractRegistry))
	for (const [attribute, values] of Object.entries(contract.stateAttributes)) {
		const existing = AllowedStateValues.get(attribute) ?? new Set<string>();
		for (const value of values) existing.add(value);
		AllowedStateValues.set(attribute, existing);
	}

export interface ZoneThemeStylesheetIssue {
	readonly code: string;
	readonly column?: number;
	readonly line?: number;
	readonly message: string;
}

export interface ZoneThemeAutomatedReview {
	readonly contractVersion: typeof ZoneStylingContract.version;
	readonly declarationCount: number;
	readonly minifiedBytes: number;
	readonly ruleCount: number;
	readonly selectorCount: number;
}

export interface ReviewedZoneThemeStylesheet {
	readonly automatedReview: ZoneThemeAutomatedReview;
	readonly sha256: string;
	readonly transformedCss: string;
}

export class ZoneThemeStylesheetRejected extends TypeError {
	constructor(readonly issues: readonly ZoneThemeStylesheetIssue[]) {
		super("Zone theme stylesheet failed automated review");
	}
}

function issue(
	issues: ZoneThemeStylesheetIssue[],
	code: string,
	message: string,
	node?: CssNode,
): void {
	issues.push({
		code,
		message,
		...(node?.loc ? { line: node.loc.start.line, column: node.loc.start.column } : {}),
	});
}

function attributeValue(node: AttributeSelector): string | undefined {
	if (node.value?.type === "Identifier") return node.value.name;
	if (node.value?.type === "String") return node.value.value;
	return;
}

function validateContractAttribute(
	node: AttributeSelector,
	issues: ZoneThemeStylesheetIssue[],
): void {
	const name = node.name.name;
	if (!AllowedAttributeNames.has(name)) {
		issue(issues, "unsupported_attribute", "Selector uses an unpublished attribute", node);
		return;
	}
	if (node.flags)
		issue(issues, "attribute_flags", "Case-insensitive attribute matching is not allowed", node);
	if (
		node.matcher &&
		(name === "data-style-role"
			? node.matcher !== "=" && node.matcher !== "~="
			: node.matcher !== "=")
	)
		issue(issues, "attribute_matcher", "Selector uses an unsupported attribute matcher", node);
	const value = attributeValue(node);
	if (!value) return;
	if (name === "data-block-type" && !AllowedBlockTypes.has(value))
		issue(issues, "unsupported_block_type", "Selector uses an unknown Block type", node);
	if (name === "data-part" && !AllowedParts.has(value))
		issue(issues, "unsupported_part", "Selector uses an unpublished Block part", node);
	if (name === "data-style-role" && !StyleRolePattern.test(value))
		issue(issues, "invalid_style_role", "Selector uses an invalid semantic style role", node);
	if (name === "data-zone-surface" && value !== "page" && value !== "dock")
		issue(issues, "invalid_surface", "Selector uses an unknown Zone surface", node);
	const stateValues = AllowedStateValues.get(name);
	if (stateValues && !stateValues.has(value))
		issue(issues, "unsupported_state", "Selector uses an unpublished Block state", node);
}

function validateSelector(selector: Selector, issues: ZoneThemeStylesheetIssue[]): void {
	let components = 0;
	let usesBlockPartOrState = false;
	const blockTypes = new Set<string>();
	const partNodes: AttributeSelector[] = [];
	const stateNodes: AttributeSelector[] = [];
	walk(selector, (node) => {
		if (node.type !== "Selector" && node.type !== "SelectorList") components += 1;
		if (
			node.type === "ClassSelector" ||
			node.type === "IdSelector" ||
			(node.type === "TypeSelector" && node.name !== "*")
		)
			issue(
				issues,
				"private_selector",
				"Theme selectors must use only the published semantic data contract",
				node,
			);
		if (node.type === "AttributeSelector") {
			validateContractAttribute(node, issues);
			const value = attributeValue(node);
			if (node.name.name === "data-block-type" && value && AllowedBlockTypes.has(value))
				blockTypes.add(value);
			if (node.name.name === "data-part") partNodes.push(node);
			if (AllowedStateValues.has(node.name.name)) stateNodes.push(node);
			usesBlockPartOrState ||=
				node.name.name === "data-part" || AllowedStateValues.has(node.name.name);
		}
		if (node.type === "TypeSelector" && node.name === "*")
			issue(issues, "universal_selector", "Universal selectors are not allowed", node);
		if (node.type === "PseudoClassSelector" && !AllowedPseudoClasses.has(node.name))
			issue(issues, "unsupported_pseudo_class", "Selector uses an unsupported pseudo-class", node);
		if (node.type === "PseudoElementSelector" && !AllowedPseudoElements.has(node.name))
			issue(
				issues,
				"unsupported_pseudo_element",
				"Selector uses an unsupported pseudo-element",
				node,
			);
	});
	if (components > MaximumZoneThemeSelectorComponents)
		issue(issues, "selector_too_complex", "Selector exceeds the component limit", selector);
	if (usesBlockPartOrState && blockTypes.size !== 1)
		issue(
			issues,
			"unanchored_block_part",
			"Block parts and states require exactly one explicit data-block-type value",
			selector,
		);
	if (blockTypes.size === 1) {
		for (const partNode of partNodes) {
			const part = attributeValue(partNode);
			if (
				part &&
				![...blockTypes].some((blockType) =>
					ZoneBlockStylingContractRegistry[
						blockType as keyof typeof ZoneBlockStylingContractRegistry
					].parts.includes(part as never),
				)
			)
				issue(
					issues,
					"part_block_mismatch",
					"Block part is not published by the selected Block type",
					partNode,
				);
		}
		for (const stateNode of stateNodes) {
			const state = stateNode.name.name;
			const value = attributeValue(stateNode);
			if (
				value &&
				![...blockTypes].some((blockType) => {
					const contract =
						ZoneBlockStylingContractRegistry[
							blockType as keyof typeof ZoneBlockStylingContractRegistry
						];
					const values = contract.stateAttributes[state as keyof typeof contract.stateAttributes] as
						| readonly string[]
						| undefined;
					return values?.includes(value) ?? false;
				})
			)
				issue(
					issues,
					"state_block_mismatch",
					"Block state is not published by the selected Block type",
					stateNode,
				);
		}
	}
}

function hexadecimalColor(value: string): [number, number, number] | undefined {
	const match = /^#([0-9a-f]{6})$/i.exec(value);
	if (!match) return;
	const numeric = Number.parseInt(match[1]!, 16);
	return [(numeric >> 16) & 255, (numeric >> 8) & 255, numeric & 255];
}

function relativeLuminance(color: [number, number, number]): number {
	const channels = color.map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(left: [number, number, number], right: [number, number, number]): number {
	const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
	const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
	return (lighter + 0.05) / (darker + 0.05);
}

function declarations(rule: Rule): readonly Declaration[] {
	const result: Declaration[] = [];
	rule.block.children.forEach((node) => {
		if (node.type === "Declaration") result.push(node);
	});
	return result;
}

function validateRuleAccessibility(rule: Rule, issues: ZoneThemeStylesheetIssue[]): void {
	if (rule.prelude.type !== "SelectorList") return;
	const selector = generate(rule.prelude);
	const values = new Map(
		declarations(rule).map((declaration) => [
			declaration.property.toLowerCase(),
			generate(declaration.value).trim().toLowerCase(),
		]),
	);
	if (
		selector.includes(":focus") &&
		(values.get("outline") === "none" || values.get("outline") === "0") &&
		(!values.get("box-shadow") || values.get("box-shadow") === "none")
	)
		issue(
			issues,
			"focus_outline_removed",
			"Focus outlines require a visible replacement in the same rule",
			rule,
		);
	const foreground = hexadecimalColor(values.get("color") ?? "");
	const background = hexadecimalColor(
		values.get("background-color") ?? values.get("background") ?? "",
	);
	if (foreground && background && contrastRatio(foreground, background) < 4.5)
		issue(
			issues,
			"insufficient_contrast",
			"Explicit text and background colors in one rule must meet 4.5:1 contrast",
			rule,
		);
}

function inNoPreferenceMotionQuery(node: Declaration, root: CssNode): boolean {
	let guarded = false;
	walk(root, function (candidate) {
		if (candidate !== node) return;
		const prelude = this.atrule?.prelude;
		guarded =
			this.atrule?.name.toLowerCase() === "media" &&
			prelude !== null &&
			prelude !== undefined &&
			generate(prelude).includes("prefers-reduced-motion:no-preference");
	});
	return guarded;
}

function validateDeclaration(
	declaration: Declaration,
	root: CssNode,
	allowedAssetIds: ReadonlySet<string>,
	issues: ZoneThemeStylesheetIssue[],
): void {
	const property = declaration.property.toLowerCase();
	const value = generate(declaration.value).trim();
	if (property === "behavior" || property === "-moz-binding")
		issue(issues, "unsafe_property", "Executable CSS extensions are not allowed", declaration);
	if (
		(property === "animation" ||
			property === "animation-name" ||
			property === "transition" ||
			property === "transition-property") &&
		!inNoPreferenceMotionQuery(declaration, root)
	)
		issue(
			issues,
			"unguarded_motion",
			"Animation and transition declarations require a prefers-reduced-motion no-preference guard",
			declaration,
		);
	if (
		property === "content" &&
		!/^(?:none|normal|["']{2}|counter\([^)]*\)|counters\([^)]*\))$/i.test(value)
	)
		issue(
			issues,
			"unsafe_content",
			"Generated content may be empty, none, normal, or a counter only",
			declaration,
		);
	const match = property.startsWith("--")
		? { error: null }
		: lexer.matchProperty(declaration.property, declaration.value);
	if (match.error)
		issue(issues, "invalid_declaration", "Declaration does not match CSS syntax", declaration);
	walk(declaration.value, (node) => {
		if (node.type !== "Url") return;
		const assetMatch = ThemeAssetUrl.exec(node.value);
		if (!assetMatch || !allowedAssetIds.has(assetMatch[1]!.toLowerCase()))
			issue(
				issues,
				"unapproved_url",
				"URL must reference a ready, public image asset declared by this revision",
				node,
			);
	});
}

function scopeRules(root: CssNode): void {
	walk(root, {
		visit: "Rule",
		enter(node) {
			if (this.atrule?.name.toLowerCase().endsWith("keyframes")) return;
			if (node.prelude.type !== "SelectorList") return;
			const selectors: string[] = [];
			node.prelude.children.forEach((selector) => {
				selectors.push(ThemeScopeSelector + " " + generate(selector));
			});
			const scoped = parse(selectors.join(","), { context: "selectorList" });
			if (scoped.type !== "SelectorList")
				throw new TypeError("Scoped Zone theme selector did not parse as a selector list");
			node.prelude = scoped;
		},
	});
}

/** Strict AST review and scope transformation for one immutable theme revision. */
export function reviewZoneThemeStylesheet(input: {
	readonly assetIds?: readonly string[];
	readonly css: string;
}): ReviewedZoneThemeStylesheet {
	const issues: ZoneThemeStylesheetIssue[] = [];
	if (Buffer.byteLength(input.css, "utf8") > MaximumZoneThemeStylesheetBytes)
		issue(issues, "stylesheet_too_large", "Stylesheet exceeds the 64 KiB source limit");
	const root = parse(input.css, {
		positions: true,
		parseCustomProperty: true,
		onParseError(error, fallbackNode) {
			issue(issues, "parse_error", error.message, fallbackNode);
		},
	});
	if (root.type !== "StyleSheet")
		issue(issues, "invalid_root", "Theme source must parse as a stylesheet", root);

	let declarationCount = 0;
	let ruleCount = 0;
	let selectorCount = 0;
	const allowedAssetIds = new Set((input.assetIds ?? []).map((id) => id.toLowerCase()));
	walk(root, (node) => {
		if (node.type === "Raw")
			issue(issues, "unparsed_css", "Unparsed CSS is not accepted for review", node);
		if (node.type === "Atrule" && !AllowedAtRules.has(node.name.toLowerCase()))
			issue(issues, "unsupported_at_rule", "At-rule is not allowed in Zone themes", node);
		if (node.type === "Rule") {
			ruleCount += 1;
			validateRuleAccessibility(node, issues);
		}
		if (node.type === "Selector") {
			selectorCount += 1;
			validateSelector(node, issues);
		}
		if (node.type === "Declaration") {
			declarationCount += 1;
			validateDeclaration(node, root, allowedAssetIds, issues);
		}
	});
	if (ruleCount > MaximumZoneThemeRules)
		issue(issues, "too_many_rules", "Stylesheet exceeds the rule limit");
	if (selectorCount > MaximumZoneThemeSelectors)
		issue(issues, "too_many_selectors", "Stylesheet exceeds the selector limit");
	if (declarationCount > MaximumZoneThemeDeclarations)
		issue(issues, "too_many_declarations", "Stylesheet exceeds the declaration limit");
	if (issues.length) throw new ZoneThemeStylesheetRejected(issues);

	scopeRules(root);
	const transformedCss = generate(root);
	const minifiedBytes = Buffer.byteLength(transformedCss, "utf8");
	if (minifiedBytes > MaximumZoneThemeStylesheetBytes)
		throw new ZoneThemeStylesheetRejected([
			{
				code: "transformed_stylesheet_too_large",
				message: "Scoped stylesheet exceeds the 64 KiB output limit",
			},
		]);
	return {
		automatedReview: {
			contractVersion: ZoneStylingContract.version,
			declarationCount,
			minifiedBytes,
			ruleCount,
			selectorCount,
		},
		sha256: createHash("sha256").update(transformedCss).digest("hex"),
		transformedCss,
	};
}
