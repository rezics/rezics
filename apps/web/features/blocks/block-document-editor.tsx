"use client";

import {
	createBlockKey,
	type DockDocument,
	type UnitReferencedBlock,
	type UnitReferencedBlockDocument,
} from "@rezics/block";
import { SearchTemplateIdValues, type SearchTemplateId } from "@rezics/filter";
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
import { useState } from "react";

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
	readonly sources: Record<SearchTemplateId, string>;
	readonly appearances: Record<
		"inline" | "card" | "cover" | "links" | "buttons" | "tabs" | "drawer",
		string
	>;
	readonly orientations: Record<"horizontal" | "vertical", string>;
	readonly resultsLayouts: Record<"list" | "grid" | "compact", string>;
	readonly styles: Record<"line" | "space" | "section", string>;
	readonly types: Record<string, string>;
}

export type BlockEditorDocument = UnitReferencedBlockDocument | DockDocument;
export type BlockEditorAddableType = "post-full-view" | "unit-ref" | "feed" | "menu" | "divider";
const DefaultAddableBlockTypes: readonly BlockEditorAddableType[] = [
	"post-full-view",
	"unit-ref",
	"feed",
	"menu",
	"divider",
];
const UnitRefAppearances = ["inline", "card", "cover"] as const;
const MenuOrientations = ["horizontal", "vertical"] as const;
const MenuAppearances = ["links", "buttons", "tabs", "drawer"] as const;
const DividerStyles = ["line", "space", "section"] as const;

function isAddableBlockType(value: string): value is BlockEditorAddableType {
	return DefaultAddableBlockTypes.some((type) => type === value);
}

function isSearchTemplateId(value: string): value is SearchTemplateId {
	return SearchTemplateIdValues.some((template) => template === value);
}

function isUnitRefAppearance(value: string): value is (typeof UnitRefAppearances)[number] {
	return UnitRefAppearances.some((appearance) => appearance === value);
}

function isMenuOrientation(value: string): value is (typeof MenuOrientations)[number] {
	return MenuOrientations.some((orientation) => orientation === value);
}

function isMenuAppearance(value: string): value is (typeof MenuAppearances)[number] {
	return MenuAppearances.some((appearance) => appearance === value);
}

function isDividerStyle(value: string): value is (typeof DividerStyles)[number] {
	return DividerStyles.some((style) => style === value);
}

function createBlock(type: BlockEditorAddableType): UnitReferencedBlock {
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
	addableTypes = DefaultAddableBlockTypes,
	allowZoneSearchSource = true,
	document,
	labels,
	onChange,
}: {
	readonly addableTypes?: readonly BlockEditorAddableType[];
	readonly allowZoneSearchSource?: boolean;
	readonly document: BlockEditorDocument;
	readonly labels: BlockEditorLabels;
	readonly onChange: (document: BlockEditorDocument) => void;
}) {
	const firstAddableType = addableTypes[0];
	const [selectedType, setSelectedType] = useState<BlockEditorAddableType | undefined>(
		firstAddableType,
	);
	const activeType =
		selectedType && addableTypes.includes(selectedType) ? selectedType : firstAddableType;

	function replace(index: number, block: UnitReferencedBlock) {
		onChange({ ...document, blocks: document.blocks.with(index, block) });
	}
	function move(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= document.blocks.length) return;
		const blocks = [...document.blocks];
		[blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
		onChange({ ...document, blocks });
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
										})
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
							allowZoneSearchSource={allowZoneSearchSource}
							labels={labels}
							onChange={(next) => replace(index, next)}
						/>
					</CardContent>
				</Card>
			))}
			{activeType ? (
				<FieldGroup className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
					<Field>
						<FieldLabel>{labels.type}</FieldLabel>
						<NativeSelect
							onChange={(event) => {
								const value = event.currentTarget.value;
								if (isAddableBlockType(value) && addableTypes.includes(value))
									setSelectedType(value);
							}}
							value={activeType}
						>
							{addableTypes.map((type) => (
								<NativeSelectOption key={type} value={type}>
									{labels.types[type] ?? type}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Button
						onClick={() =>
							onChange({
								...document,
								blocks: [...document.blocks, createBlock(activeType)],
							})
						}
						type="button"
					>
						<Plus aria-hidden /> {labels.add}
					</Button>
				</FieldGroup>
			) : null}
		</div>
	);
}

function BlockFields({
	allowZoneSearchSource,
	block,
	labels,
	onChange,
}: {
	readonly allowZoneSearchSource: boolean;
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
							onChange={(event) => {
								const { value } = event.currentTarget;
								if (isUnitRefAppearance(value))
									onChange({ ...block, appearance: value });
							}}
							value={block.appearance}
						>
							{UnitRefAppearances.map((value) => (
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
						onChange={(event) => {
							const value = event.currentTarget.value;
							if (value === "zone-feature" && allowZoneSearchSource)
								onChange({ ...block, feature: { kind: "zone" } });
							else if (isSearchTemplateId(value))
								onChange({
									...block,
									feature: { kind: "template", template: value },
								});
						}}
						value={
							block.feature.kind === "zone" ? "zone-feature" : block.feature.template
						}
					>
						{allowZoneSearchSource || block.feature.kind === "zone" ? (
							<NativeSelectOption
								disabled={!allowZoneSearchSource}
								value="zone-feature"
							>
								{labels.zoneSearch}
							</NativeSelectOption>
						) : null}
						{SearchTemplateIdValues.map((value) => (
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
						onChange={(event) => {
							const { value } = event.currentTarget;
							if (isMenuOrientation(value))
								onChange({ ...block, orientation: value });
						}}
						value={block.orientation}
					>
						{MenuOrientations.map((value) => (
							<NativeSelectOption key={value} value={value}>
								{labels.orientations[value]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel>{labels.appearance}</FieldLabel>
					<NativeSelect
						onChange={(event) => {
							const { value } = event.currentTarget;
							if (isMenuAppearance(value)) onChange({ ...block, appearance: value });
						}}
						value={block.appearance}
					>
						{MenuAppearances.map((value) => (
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
					onChange={(event) => {
						const { value } = event.currentTarget;
						if (isDividerStyle(value)) onChange({ ...block, style: value });
					}}
					value={block.style}
				>
					{DividerStyles.map((value) => (
						<NativeSelectOption key={value} value={value}>
							{labels.styles[value]}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		);
	return null;
}
