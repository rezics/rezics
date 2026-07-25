"use client";

import {
	createBlockKey,
	type DockDocument,
	type UnitReferencedBlock,
	type UnitReferencedBlockDocument,
} from "@rezics/block";
import {
	Button,
	Card,
	CardContent,
	Checkbox,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	NativeSelect,
	NativeSelectOption,
} from "@rezics/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

export interface BlockEditorLabels {
	readonly add: string;
	readonly remove: string;
	readonly moveUp: string;
	readonly moveDown: string;
	readonly type: string;
	readonly identifier: string;
	readonly appearance: string;
	readonly searchSource: string;
	readonly zoneSearch: string;
	readonly menuNavigation: string;
	readonly results: string;
	readonly showResultCount: string;
	readonly orientation: string;
	readonly style: string;
	readonly sources: Record<"global" | "book" | "media" | "software", string>;
	readonly appearances: Record<
		"inline" | "card" | "cover" | "links" | "buttons" | "tabs" | "drawer",
		string
	>;
	readonly orientations: Record<"horizontal" | "vertical", string>;
	readonly resultsLayouts: Record<"list" | "grid" | "compact", string>;
	readonly styles: Record<"line" | "space" | "section", string>;
	readonly types: Record<string, string>;
}

type EditableDocument = UnitReferencedBlockDocument | DockDocument;
type AddableBlockType = "post-full-view" | "unit-ref" | "feed" | "menu" | "divider";
const AddableBlockTypes: readonly AddableBlockType[] = [
	"post-full-view",
	"unit-ref",
	"feed",
	"menu",
	"divider",
];

function createBlock(type: AddableBlockType): UnitReferencedBlock {
	const _key = createBlockKey();
	switch (type) {
		case "post-full-view":
			return { _type: type, _key, postId: "" };
		case "unit-ref":
			return { _type: type, _key, unitId: "", appearance: "card" };
		case "feed":
			return {
				_type: type,
				_key,
				feature: { kind: "zone" },
				presentation: { pagination: "load-more", showResultCount: true },
			};
		case "menu":
			return {
				_type: type,
				_key,
				navigationId: "",
				orientation: "horizontal",
				appearance: "links",
			};
		case "divider":
			return { _type: type, _key, style: "line" };
	}
}

export function BlockDocumentEditor({
	document,
	labels,
	onChange,
}: {
	readonly document: EditableDocument;
	readonly labels: BlockEditorLabels;
	readonly onChange: (document: EditableDocument) => void;
}) {
	function replace(index: number, block: UnitReferencedBlock) {
		onChange({ ...document, blocks: document.blocks.with(index, block) } as EditableDocument);
	}
	function move(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= document.blocks.length) return;
		const blocks = [...document.blocks];
		[blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
		onChange({ ...document, blocks } as EditableDocument);
	}
	return (
		<div className="grid gap-4">
			{document.blocks.map((block, index) => (
				<Card appearance="outlined" key={block._key}>
					<CardContent className="grid gap-4 p-4">
						<div className="flex items-center justify-between gap-3">
							<strong>{labels.types[block._type] ?? block._type}</strong>
							<div className="flex gap-1">
								<Button
									aria-label={labels.moveUp}
									disabled={index === 0}
									onClick={() => move(index, -1)}
									size="icon-sm"
									type="button"
									variant="quiet"
								>
									<ArrowUp aria-hidden />
								</Button>
								<Button
									aria-label={labels.moveDown}
									disabled={index === document.blocks.length - 1}
									onClick={() => move(index, 1)}
									size="icon-sm"
									type="button"
									variant="quiet"
								>
									<ArrowDown aria-hidden />
								</Button>
								<Button
									aria-label={labels.remove}
									onClick={() =>
										onChange({
											...document,
											blocks: document.blocks.filter(
												(_, candidate) => candidate !== index,
											),
										} as EditableDocument)
									}
									size="icon-sm"
									type="button"
									variant="quiet"
								>
									<Trash2 aria-hidden />
								</Button>
							</div>
						</div>
						<BlockFields
							block={block}
							labels={labels}
							onChange={(next) => replace(index, next)}
						/>
					</CardContent>
				</Card>
			))}
			<FieldGroup className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
				<Field>
					<FieldLabel>{labels.type}</FieldLabel>
					<NativeSelect defaultValue="search" id={`${document._key}-new-block`}>
						{AddableBlockTypes.map((type) => (
							<NativeSelectOption key={type} value={type}>
								{labels.types[type] ?? type}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Button
					onClick={() => {
						const select = window.document.getElementById(
							`${document._key}-new-block`,
						) as HTMLSelectElement | null;
						const type = AddableBlockTypes.find(
							(candidate) => candidate === select?.value,
						);
						if (type)
							onChange({
								...document,
								blocks: [...document.blocks, createBlock(type)],
							} as EditableDocument);
					}}
					type="button"
				>
					<Plus aria-hidden /> {labels.add}
				</Button>
			</FieldGroup>
		</div>
	);
}

function BlockFields({
	block,
	labels,
	onChange,
}: {
	readonly block: UnitReferencedBlock;
	readonly labels: BlockEditorLabels;
	readonly onChange: (block: UnitReferencedBlock) => void;
}) {
	if (block._type === "post-full-view" || block._type === "unit-ref") {
		const identifier = block._type === "post-full-view" ? block.postId : block.unitId;
		return (
			<FieldGroup className="grid gap-4 sm:grid-cols-2">
				<Field required>
					<FieldLabel>{labels.identifier}</FieldLabel>
					<Input
						onChange={(event) =>
							onChange(
								block._type === "post-full-view"
									? { ...block, postId: event.currentTarget.value }
									: { ...block, unitId: event.currentTarget.value },
							)
						}
						required
						value={identifier}
					/>
				</Field>
				{block._type === "unit-ref" && (
					<Field>
						<FieldLabel>{labels.appearance}</FieldLabel>
						<NativeSelect
							onChange={(event) =>
								onChange({
									...block,
									appearance: event.currentTarget
										.value as typeof block.appearance,
								})
							}
							value={block.appearance}
						>
							{(["inline", "card", "cover"] as const).map((value) => (
								<NativeSelectOption key={value} value={value}>
									{labels.appearances[value]}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				)}
			</FieldGroup>
		);
	}
	if (block._type === "feed")
		return (
			<FieldGroup className="grid gap-4">
				<Field>
					<FieldLabel>{labels.searchSource}</FieldLabel>
					<NativeSelect
						onChange={(event) =>
							onChange({
								...block,
								feature:
									event.currentTarget.value === "zone"
										? { kind: "zone" }
										: {
												kind: "template",
												template: event.currentTarget.value as
													"global" | "book" | "media" | "software",
											},
							})
						}
						value={block.feature.kind === "zone" ? "zone" : block.feature.template}
					>
						<NativeSelectOption value="zone">{labels.zoneSearch}</NativeSelectOption>
						{(["global", "book", "media", "software"] as const).map((value) => (
							<NativeSelectOption key={value} value={value}>
								{labels.sources[value]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<label className="flex items-center gap-2 text-sm">
					<Checkbox
						checked={block.presentation.showResultCount}
						onCheckedChange={(details) =>
							onChange({
								...block,
								presentation: {
									...block.presentation,
									showResultCount: details.checked === true,
								},
							})
						}
					/>
					{labels.showResultCount}
				</label>
			</FieldGroup>
		);
	if (block._type === "menu")
		return (
			<FieldGroup className="grid gap-4 sm:grid-cols-3">
				<Field required>
					<FieldLabel>{labels.menuNavigation}</FieldLabel>
					<Input
						onChange={(event) =>
							onChange({ ...block, navigationId: event.currentTarget.value })
						}
						required
						value={block.navigationId}
					/>
				</Field>
				<Field>
					<FieldLabel>{labels.orientation}</FieldLabel>
					<NativeSelect
						onChange={(event) =>
							onChange({
								...block,
								orientation: event.currentTarget.value as typeof block.orientation,
							})
						}
						value={block.orientation}
					>
						{(["horizontal", "vertical"] as const).map((value) => (
							<NativeSelectOption key={value} value={value}>
								{labels.orientations[value]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel>{labels.appearance}</FieldLabel>
					<NativeSelect
						onChange={(event) =>
							onChange({
								...block,
								appearance: event.currentTarget.value as typeof block.appearance,
							})
						}
						value={block.appearance}
					>
						{(["links", "buttons", "tabs", "drawer"] as const).map((value) => (
							<NativeSelectOption key={value} value={value}>
								{labels.appearances[value]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</FieldGroup>
		);
	if (block._type === "divider")
		return (
			<Field>
				<FieldLabel>{labels.style}</FieldLabel>
				<NativeSelect
					onChange={(event) =>
						onChange({
							...block,
							style: event.currentTarget.value as typeof block.style,
						})
					}
					value={block.style}
				>
					{(["line", "space", "section"] as const).map((value) => (
						<NativeSelectOption key={value} value={value}>
							{labels.styles[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		);
	return null;
}
