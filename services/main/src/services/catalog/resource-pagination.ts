/** Bounded wire pages advance only over consumed candidates, including filtered rows. @internal */
export function catalogWirePage<T>(
	rows: readonly { id: string; value: T | null }[],
	limit: number,
	maximumBytes = 2_097_152,
) {
	const items: T[] = [];
	let bytes = 128;
	let lastConsumed: string | null = null;
	let more = rows.length > limit;
	for (const row of rows.slice(0, limit)) {
		if (row.value !== null) {
			const encodedBytes = Buffer.byteLength(JSON.stringify(row.value), "utf8") + 1;
			if (encodedBytes + 128 > maximumBytes)
				throw new RangeError("One catalog form exceeds the response byte budget");
			if (bytes + encodedBytes > maximumBytes) {
				more = true;
				break;
			}
			items.push(row.value);
			bytes += encodedBytes;
		}
		lastConsumed = row.id;
	}
	return { items, nextCursor: more ? lastConsumed : null };
}
