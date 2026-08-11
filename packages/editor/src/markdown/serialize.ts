import { buildMarksTree, nestLists } from "@portabletext/toolkit";
import type {
	BlockContent,
	Image,
	List,
	ListItem,
	PhrasingContent,
	Root,
	Table,
	TableCell,
	TableRow,
} from "mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import type { RezicsPortableTextValue } from "./types";

type PortableTextRecord = Record<string, unknown>;
type MarksTreeBlock = Parameters<typeof buildMarksTree>[0];

function asRecord(value: unknown): PortableTextRecord {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		throw new TypeError("Expected a proven Portable Text object");
	return value as PortableTextRecord;
}

function records(value: unknown): PortableTextRecord[] {
	if (!Array.isArray(value)) throw new TypeError("Expected a proven Portable Text array");
	return value.map(asRecord);
}

function stringValue(value: unknown): string {
	if (typeof value !== "string") throw new TypeError("Expected a proven string field");
	return value;
}

function imageNode(value: PortableTextRecord): Image {
	return {
		type: "image",
		url: stringValue(value.src),
		alt: typeof value.alt === "string" ? value.alt : "",
		...(typeof value.title === "string" ? { title: value.title } : {}),
	};
}

function splitText(value: string): PhrasingContent[] {
	const lines = value.split("\n");
	const result: PhrasingContent[] = [];
	for (const [index, line] of lines.entries()) {
		if (index > 0) result.push({ type: "break" });
		if (line.length > 0 || lines.length === 1) result.push({ type: "text", value: line });
	}
	return result;
}

function textFromMarkTree(value: PortableTextRecord): string {
	if (value._type === "@text") return stringValue(value.text);
	if (value._type !== "@span") throw new TypeError("Expected a text-only code mark subtree");
	return records(value.children)
		.map((child) => {
			if (child._type !== "@text") throw new TypeError("Expected a text-only code mark subtree");
			return stringValue(child.text);
		})
		.join("");
}

function markTreePhrasing(value: PortableTextRecord): PhrasingContent[] {
	if (value._type === "@text") return splitText(stringValue(value.text));
	if (value._type === "image") return [imageNode(value)];
	if (value._type !== "@span") throw new TypeError("Unexpected proven inline object");

	const markType = stringValue(value.markType);
	if (markType === "code") return [{ type: "inlineCode", value: textFromMarkTree(value) }];
	const children = records(value.children).flatMap(markTreePhrasing);
	switch (markType) {
		case "strike-through":
			return [{ type: "delete", children }];
		case "em":
			return [{ type: "emphasis", children }];
		case "strong":
			return [{ type: "strong", children }];
		case "link": {
			const definition = asRecord(value.markDef);
			return [
				{
					type: "link",
					url: stringValue(definition.href),
					...(typeof definition.title === "string" ? { title: definition.title } : {}),
					children,
				},
			];
		}
		default:
			throw new TypeError("Unexpected proven mark type");
	}
}

function blockPhrasing(
	block: PortableTextRecord,
	children: readonly PortableTextRecord[] = records(block.children),
): PhrasingContent[] {
	const tree = buildMarksTree({ ...block, children } as unknown as MarksTreeBlock);
	return tree.map(asRecord).flatMap(markTreePhrasing);
}

function textBlockContent(
	block: PortableTextRecord,
	children?: readonly PortableTextRecord[],
): BlockContent {
	const content = blockPhrasing(block, children);
	const style = block.style ?? "normal";
	if (style === "blockquote")
		return { type: "blockquote", children: [{ type: "paragraph", children: content }] };
	if (typeof style === "string" && /^h[1-6]$/u.test(style))
		return {
			type: "heading",
			depth: Number(style.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6,
			children: content,
		};
	return { type: "paragraph", children: content };
}

function tableCell(value: PortableTextRecord): TableCell {
	const [block] = records(value.value);
	if (!block) throw new TypeError("Expected a proven table cell block");
	return { type: "tableCell", children: blockPhrasing(block) };
}

function tableRow(value: PortableTextRecord): TableRow {
	return { type: "tableRow", children: records(value.cells).map(tableCell) };
}

function tableBlock(value: PortableTextRecord): Table {
	const rows = records(value.rows).map(tableRow);
	const columnCount = rows[0]?.children.length ?? 0;
	if (value.headerRows === 0) {
		rows.unshift({
			type: "tableRow",
			children: Array.from({ length: columnCount }, () => ({
				type: "tableCell",
				children: [],
			})),
		});
	}
	return {
		type: "table",
		...(Array.isArray(value.alignment)
			? {
					align: value.alignment.map((alignment) =>
						alignment === "left" || alignment === "center" || alignment === "right"
							? alignment
							: null,
					),
				}
			: {}),
		children: rows,
	};
}

function isNestedList(value: PortableTextRecord): boolean {
	return value._type === "@list";
}

function listItem(value: PortableTextRecord): ListItem {
	const allChildren = records(value.children);
	const inlineChildren = allChildren.filter((child) => !isNestedList(child));
	const nestedLists = allChildren.filter(isNestedList).map(listBlock);
	return {
		type: "listItem",
		spread: false,
		...(value.listItem === "task" ? { checked: value.checked === true } : {}),
		children: [textBlockContent(value, inlineChildren), ...nestedLists],
	};
}

function listBlock(value: PortableTextRecord): List {
	return {
		type: "list",
		ordered: value.listItem === "number",
		spread: false,
		children: records(value.children).map(listItem),
	};
}

function knownBlock(value: PortableTextRecord): BlockContent {
	switch (value._type) {
		case "block":
			return textBlockContent(value);
		case "code":
			return {
				type: "code",
				value: stringValue(value.code),
				...(typeof value.language === "string" && value.language.length > 0
					? { lang: value.language }
					: {}),
			};
		case "horizontal-rule":
			return { type: "thematicBreak" };
		case "html":
			return { type: "html", value: stringValue(value.html) };
		case "image":
			return { type: "paragraph", children: [imageNode(value)] };
		case "table":
			return tableBlock(value);
		default:
			throw new TypeError("Unexpected proven block type");
	}
}

function rootFromPortableText(value: RezicsPortableTextValue): Root {
	const nested = nestLists([...value], "html").map(asRecord);
	const children: BlockContent[] = [];
	for (let index = 0; index < nested.length; index += 1) {
		const current = nested[index];
		if (!current) continue;
		if (isNestedList(current)) {
			children.push(listBlock(current));
			continue;
		}
		if (current._type === "block" && current.style === "blockquote") {
			const quoted: BlockContent[] = [];
			let nextIndex = index;
			while (nextIndex < nested.length) {
				const candidate = nested[nextIndex];
				if (!candidate || candidate._type !== "block" || candidate.style !== "blockquote") break;
				quoted.push({ type: "paragraph", children: blockPhrasing(candidate) });
				nextIndex += 1;
			}
			children.push({ type: "blockquote", children: quoted });
			index = nextIndex - 1;
			continue;
		}
		children.push(knownBlock(current));
	}
	return { type: "root", children };
}

export function serializeRezicsPortableText(value: RezicsPortableTextValue): string {
	return toMarkdown(rootFromPortableText(value), {
		bullet: "-",
		emphasis: "_",
		extensions: [gfmToMarkdown({ tableCellPadding: true, tablePipeAlign: false })],
		fences: true,
		listItemIndent: "one",
		rule: "-",
		strong: "*",
	});
}
