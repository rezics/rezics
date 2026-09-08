import { type CatalogSourceReceipt, readCatalogSourceProfileBytes } from "./source-observations";

/** @internal Read the selected archived profile (defaulting to its native view); these are not canonical facts. */
export async function readCatalogSourceField(
	receipt: CatalogSourceReceipt,
	field: string,
	profileKey?: string,
): Promise<unknown> {
	if (Buffer.byteLength(field, "utf8") > 512)
		throw new RangeError("Source field path exceeds its budget");
	const value: unknown = JSON.parse(
		new TextDecoder("utf-8", { fatal: true }).decode(await readCatalogSourceProfileBytes(receipt, profileKey)),
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
