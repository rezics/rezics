import { createHash } from "node:crypto";

import {
	ZoneBlockStylingContractRegistry,
	ZoneStylingContract,
	ZoneStylingContractRichTextBoundaryAttribute,
	ZoneStylingContractRichTextElementValues,
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

import { RezicsVersion } from "../../version";

export const MaximumZoneThemeStylesheetBytes = 64 * 1_024;
export const MaximumZoneThemeRules = 256;
export const MaximumZoneThemeSelectors = 512;
export const MaximumZoneThemeDeclarations = 2_048;
export const MaximumZoneThemeSelectorComponents = 32;

const ThemeAssetUrl =
	/^\/image-assets\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\/content$/;
const RevisionIdPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
// Cascade layers and keyframe names have document-global effects, so they are
// excluded even though every ordinary selector is scope-prefixed.
const AllowedAtRules = new Set(["container", "media", "supports"]);
const AllowedPseudoClasses = new Set([
	"active",
	"checked",
	"disabled",
	"empty",
	"first-child",
	"first-of-type",
	"focus",
	"focus-visible",
	"focus-within",
	"has",
	"hover",
	"is",
	"last-child",
	"last-of-type",
	"not",
	"nth-child",
	"nth-last-child",
	"nth-last-of-type",
	"nth-of-type",
	"only-of-type",
	"only-child",
	"enabled",
	"any-link",
	"placeholder-shown",
	"required",
	"optional",
	"where",
]);
const AllowedPseudoElements = new Set([
	"after",
	"before",
	"first-letter",
	"first-line",
	"marker",
	"placeholder",
	"selection",
]);
const AllowedAttributeNames = new Set([
	...ZoneStylingContract.rootAttributes,
	...ZoneStylingContractStateAttributeValues,
	"data-part",
	ZoneStylingContractRichTextBoundaryAttribute,
	"data-zone-surface",
]);
const AllowedBlockTypes: ReadonlySet<string> = new Set(ZoneStylingContract.blockTypes);
const AllowedRichTextElements: ReadonlySet<string> = new Set(
	ZoneStylingContractRichTextElementValues,
);
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
	readonly rendererVersion: typeof RezicsVersion;
	readonly ruleCount: number;
	readonly selectorCount: number;
	readonly sourceSha256: string;
	readonly transformedSha256: string;
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
	const name = node.name.name.toLowerCase();
	if (!AllowedAttributeNames.has(name)) {
		issue(issues, "unsupported_attribute", "Selector uses an unpublished attribute", node);
		return;
	}
	if (node.flags)
		issue(issues, "attribute_flags", "Case-insensitive attribute matching is not allowed", node);
	if (node.matcher && node.matcher !== "=")
		issue(issues, "attribute_matcher", "Selector uses an unsupported attribute matcher", node);
	const value = attributeValue(node);
	if (name === ZoneStylingContractRichTextBoundaryAttribute && (node.matcher || value))
		issue(
			issues,
			"private_rich_text_variant",
			"The rich-text boundary publishes presence only, not internal variant values",
			node,
		);
	if (!value) return;
	if (name === "data-block-type" && !AllowedBlockTypes.has(value))
		issue(issues, "unsupported_block_type", "Selector uses an unknown Block type", node);
	if (name === "data-part" && !AllowedParts.has(value))
		issue(issues, "unsupported_part", "Selector uses an unpublished Block part", node);
	if (name === "data-zone-surface" && value !== "page" && value !== "dock")
		issue(issues, "invalid_surface", "Selector uses an unknown Zone surface", node);
	const stateValues = AllowedStateValues.get(name);
	if (stateValues && !stateValues.has(value))
		issue(issues, "unsupported_state", "Selector uses an unpublished Block state", node);
}

function richTextAnchoredTypeSelectors(selector: Selector): ReadonlySet<CssNode> {
	const anchored = new Set<CssNode>();
	const mark = (candidate: Selector, inheritedBoundary: boolean): void => {
		const compounds: CssNode[][] = [[]];
		candidate.children.forEach((node) => {
			if (node.type === "Combinator") compounds.push([]);
			else compounds.at(-1)!.push(node);
		});
		let hasPrecedingBoundary = inheritedBoundary;
		for (const compound of compounds) {
			const hasBoundary = compound.some(
				(node) =>
					node.type === "AttributeSelector" &&
					node.name.name.toLowerCase() === ZoneStylingContractRichTextBoundaryAttribute &&
					!node.matcher,
			);
			for (const node of compound) {
				if (node.type === "TypeSelector" && hasPrecedingBoundary) anchored.add(node);
				if (node.type !== "PseudoClassSelector" || !node.children) continue;
				const nestedBoundary =
					hasPrecedingBoundary || (node.name.toLowerCase() === "has" && hasBoundary);
				walk(node, (nested) => {
					if (nested.type !== "Selector") return;
					mark(nested, nestedBoundary);
					return walk.skip;
				});
			}
			hasPrecedingBoundary ||= hasBoundary;
		}
	};
	mark(selector, false);
	return anchored;
}

function validateSelector(selector: Selector, issues: ZoneThemeStylesheetIssue[]): void {
	let classAnchors = 0;
	let components = 0;
	let usesBlockPartOrState = false;
	const blockTypes = new Set<string>();
	const partNodes: AttributeSelector[] = [];
	const stateNodes: AttributeSelector[] = [];
	const richTextAnchors = richTextAnchoredTypeSelectors(selector);
	walk(selector, (node) => {
		if (node.type !== "Selector" && node.type !== "SelectorList") components += 1;
		if (node.type === "ClassSelector") {
			if (node.name.startsWith(ZoneStylingContract.customClassNamePrefix)) classAnchors += 1;
			else
				issue(
					issues,
					"unpublished_class",
					"Class selectors must use the reserved Zone-theme namespace",
					node,
				);
		}
		if (node.type === "IdSelector")
			issue(issues, "id_selector", "ID selectors are not published theme surfaces", node);
		if (node.type === "TypeSelector") {
			if (node.name === "*")
				issue(issues, "universal_selector", "Universal selectors are not allowed", node);
			else if (!AllowedRichTextElements.has(node.name.toLowerCase()))
				issue(
					issues,
					"unsupported_type_selector",
					"Type selector is outside the published rich-text vocabulary",
					node,
				);
			else if (!richTextAnchors.has(node))
				issue(
					issues,
					"unanchored_type_selector",
					"Published element selectors require a preceding rich-text boundary",
					node,
				);
		}
		if (node.type === "AttributeSelector") {
			validateContractAttribute(node, issues);
			const name = node.name.name.toLowerCase();
			const value = attributeValue(node);
			if (
				name === "data-block-type" &&
				node.matcher === "=" &&
				value &&
				AllowedBlockTypes.has(value)
			)
				blockTypes.add(value);
			if (name === "data-part") partNodes.push(node);
			if (AllowedStateValues.has(name)) stateNodes.push(node);
			usesBlockPartOrState ||= name === "data-part" || AllowedStateValues.has(name);
		}
		if (node.type === "PseudoClassSelector" && !AllowedPseudoClasses.has(node.name.toLowerCase()))
			issue(issues, "unsupported_pseudo_class", "Selector uses an unsupported pseudo-class", node);
		if (
			node.type === "PseudoElementSelector" &&
			!AllowedPseudoElements.has(node.name.toLowerCase())
		)
			issue(
				issues,
				"unsupported_pseudo_element",
				"Selector uses an unsupported pseudo-element",
				node,
			);
	});
	if (components > MaximumZoneThemeSelectorComponents)
		issue(issues, "selector_too_complex", "Selector exceeds the component limit", selector);
	if (usesBlockPartOrState && blockTypes.size !== 1 && classAnchors === 0)
		issue(
			issues,
			"unanchored_block_part",
			"Block parts and states require one explicit Block type or a reserved class hook",
			selector,
		);
	if (blockTypes.size === 1) {
		const blockType = [...blockTypes][0]! as keyof typeof ZoneBlockStylingContractRegistry;
		const contract = ZoneBlockStylingContractRegistry[blockType];
		for (const partNode of partNodes) {
			const part = attributeValue(partNode);
			if (part && !contract.parts.includes(part as never))
				issue(
					issues,
					"part_block_mismatch",
					"Block part is not published by the selected Block type",
					partNode,
				);
		}
		for (const stateNode of stateNodes) {
			const state = stateNode.name.name.toLowerCase();
			const value = attributeValue(stateNode);
			const values = contract.stateAttributes[state as keyof typeof contract.stateAttributes] as
				| readonly string[]
				| undefined;
			if (value && !values?.includes(value))
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

function scopeRules(root: CssNode, revisionId: string): void {
	const scope = parse(`[data-zone-theme-scope="${revisionId}"]`, { context: "selector" });
	if (scope.type !== "Selector")
		throw new TypeError("Zone theme revision scope did not parse as a selector");
	const themeScopeSelector = generate(scope);
	walk(root, {
		visit: "Rule",
		enter(node) {
			if (this.atrule?.name.toLowerCase().endsWith("keyframes")) return;
			if (node.prelude.type !== "SelectorList") return;
			const selectors: string[] = [];
			node.prelude.children.forEach((selector) => {
				selectors.push(themeScopeSelector + " " + generate(selector));
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
	readonly revisionId: string;
}): ReviewedZoneThemeStylesheet {
	if (!RevisionIdPattern.test(input.revisionId))
		throw new TypeError("Zone theme review requires a platform-generated revision UUID");
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
			if (node.prelude.type === "SelectorList")
				node.prelude.children.forEach((selector) => {
					if (selector.type === "Selector") validateSelector(selector, issues);
				});
		}
		if (node.type === "Selector") selectorCount += 1;
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

	scopeRules(root, input.revisionId);
	const transformedCss = generate(root);
	const minifiedBytes = Buffer.byteLength(transformedCss, "utf8");
	if (minifiedBytes > MaximumZoneThemeStylesheetBytes)
		throw new ZoneThemeStylesheetRejected([
			{
				code: "transformed_stylesheet_too_large",
				message: "Scoped stylesheet exceeds the 64 KiB output limit",
			},
		]);
	const sourceSha256 = createHash("sha256").update(input.css).digest("hex");
	const transformedSha256 = createHash("sha256").update(transformedCss).digest("hex");
	return {
		automatedReview: {
			contractVersion: ZoneStylingContract.version,
			declarationCount,
			minifiedBytes,
			rendererVersion: RezicsVersion,
			ruleCount,
			selectorCount,
			sourceSha256,
			transformedSha256,
		},
		sha256: transformedSha256,
		transformedCss,
	};
}
