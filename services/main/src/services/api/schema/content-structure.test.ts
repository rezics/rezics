import {
	BlockKey,
	CollectionDefinitionDocument,
	DockDocument,
	PortableTextDocument,
	ZoneMenuDocument,
	ZonePageDocument,
	assertDocument,
	createBlockKey,
	createDockDocument,
	createManualCollectionDefinitionDocument,
	createPortableTextDocument,
	createSystemCollectionDefinitionDocument,
	createZoneMenuDocument,
	createZonePageDocument,
	isDocument,
	isPortableTextDocument,
	updatePortableTextDocument,
} from "@rezics/content-structure";
import { describe, expect, test } from "vitest";

describe("Content Structure document contracts", () => {
	test("creates document-local twelve-character hexadecimal keys", () => {
		const keys = Array.from({ length: 32 }, () => createBlockKey());

		expect(keys).toHaveLength(32);
		expect(keys.every((key) => isDocument(BlockKey, key))).toBe(true);
		expect(new Set(keys).size).toBe(keys.length);
	});

	test("requires the Portable Text envelope instead of accepting a raw array", () => {
		const document = createPortableTextDocument([], "0123456789ab");

		expect(isPortableTextDocument(document)).toBe(true);
		expect(isPortableTextDocument([])).toBe(false);
		expect(
			isPortableTextDocument({
				_type: "portable-text",
				_key: "position-1",
				content: [],
			}),
		).toBe(false);
		expect(() => assertDocument(PortableTextDocument, [])).toThrow(
			"Invalid Content Structure document",
		);
	});

	test("preserves Portable Text identity across content updates", () => {
		const original = createPortableTextDocument([], "abcdef012345");
		const nextContent: PortableTextDocument["content"] = [];
		const updated = updatePortableTextDocument(original, nextContent);

		expect(updated).not.toBe(original);
		expect(updated._key).toBe(original._key);
		expect(updated.content).toBe(nextContent);
	});

	test("validates Realm Dock and Zone documents as Block Schema documents", () => {
		const portableText = createPortableTextDocument([], "000000000001");
		const dock = createDockDocument([portableText], "000000000002");
		const page = createZonePageDocument([portableText], "000000000003", { columns: 2 });
		const menu = createZoneMenuDocument([], "000000000004", {
			placement: "primary",
		});

		expect(isDocument(DockDocument, dock)).toBe(true);
		expect(isDocument(ZonePageDocument, page)).toBe(true);
		expect(isDocument(ZoneMenuDocument, menu)).toBe(true);
	});

	test("keeps Collection source variants mutually exclusive", () => {
		const manual = createManualCollectionDefinitionDocument("000000000005");
		const favorites = createSystemCollectionDefinitionDocument("favorites", "000000000006");

		expect(isDocument(CollectionDefinitionDocument, manual)).toBe(true);
		expect(isDocument(CollectionDefinitionDocument, favorites)).toBe(true);
		expect(
			isDocument(CollectionDefinitionDocument, {
				_type: "collection-definition",
				_key: "000000000007",
				source: "system",
			}),
		).toBe(false);
	});
});
