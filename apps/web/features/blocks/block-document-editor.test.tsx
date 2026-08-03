/** @vitest-environment jsdom */

import { createUnitReferencedBlockDocument } from "@rezics/block";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	BlockDocumentEditor,
	type BlockEditorDocument,
	type BlockEditorLabels,
} from "./block-document-editor";

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			pagination: {
				label: "More-content loading",
				modes: {
					"load-more": "Show Load more button",
					infinite: "Load automatically while scrolling",
				},
			},
		},
	}),
}));

const labels = {
	add: "Add",
	remove: "Remove",
	moveUp: "Move up",
	moveDown: "Move down",
	type: "Type",
	identifier: "Identifier",
	appearance: "Appearance",
	searchSource: "Search source",
	zoneSearch: "Zone search",
	menuNavigation: "Navigation",
	results: "Results",
	showResultCount: "Show result count",
	orientation: "Orientation",
	style: "Style",
	sources: {
		global: "Global",
		book: "Book",
		media: "Media",
		software: "Software",
		realm: "Realm",
		zone: "Zone",
	},
	appearances: {
		inline: "Inline",
		card: "Card",
		cover: "Cover",
		links: "Links",
		buttons: "Buttons",
		tabs: "Tabs",
		drawer: "Drawer",
	},
	orientations: { horizontal: "Horizontal", vertical: "Vertical" },
	resultsLayouts: { list: "List", grid: "Grid", compact: "Compact" },
	styles: { line: "Line", space: "Space", section: "Section" },
	types: { feed: "Feed" },
} satisfies BlockEditorLabels;

const initialDocument = createUnitReferencedBlockDocument(
	[
		{
			_type: "feed",
			_key: "111111111111",
			feature: { kind: "zone" },
			presentation: { pagination: "load-more", showResultCount: true },
		},
	],
	"000000000000",
);

function FeedBlockEditor({
	onChange,
}: {
	readonly onChange: (value: BlockEditorDocument) => void;
}) {
	const [document, setDocument] = useState<BlockEditorDocument>(initialDocument);
	return (
		<BlockDocumentEditor
			document={document}
			labels={labels}
			onChange={(next) => {
				setDocument(next);
				onChange(next);
			}}
			pickerPlaceholders={{ post: "Post", unit: "Unit" }}
		/>
	);
}

afterEach(cleanup);

describe("BlockDocumentEditor", () => {
	it("edits a Feed block pagination mode without changing its other presentation fields", () => {
		const onChange = vi.fn();
		render(<FeedBlockEditor onChange={onChange} />);

		const pagination = screen.getByRole("combobox", { name: "More-content loading" });
		expect(pagination).toBeInstanceOf(HTMLSelectElement);
		if (!(pagination instanceof HTMLSelectElement)) return;
		expect(pagination.value).toBe("load-more");

		fireEvent.change(pagination, { target: { value: "infinite" } });

		expect(pagination.value).toBe("infinite");
		expect(onChange).toHaveBeenLastCalledWith({
			...initialDocument,
			blocks: [
				{
					...initialDocument.blocks[0],
					presentation: { pagination: "infinite", showResultCount: true },
				},
			],
		});
	});
});
