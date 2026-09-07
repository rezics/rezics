import { type CatalogSourceReceipt, readCatalogSourceBytes } from "./source-observations";

/** @internal Raw source fields stay in the bounded immutable archive; they are not canonical facts. */
export async function readCatalogSourceField(
	receipt: CatalogSourceReceipt,
	field: string,
): Promise<unknown> {
	if (Buffer.byteLength(field, "utf8") > 512)
		throw new RangeError("Source field path exceeds its budget");
	const value: unknown = JSON.parse(
		new TextDecoder("utf-8", { fatal: true }).decode(await readCatalogSourceBytes(receipt)),
	);
	if (
		value === null ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		!Object.hasOwn(value, field)
	)
		throw new Error("Archived source field is absent");
	return Reflect.get(value, field);
}
