import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import type { CatalogReference } from "./contracts";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
/** @internal Keep multi-query values/history coherent; this lock never replaces the following native authorization check. */
export async function lockDomainSnapshot(tx: DatabaseTransaction, reference: CatalogReference) {
	const table = CatalogIdentityTables[reference.owner];
	await tx
		.select({ id: table.id })
		.from(table)
		.where(eq(table.id, reference.id))
		.limit(1)
		.for("share");
}
export const DomainPageQuerySchema = z.strictObject({
	cursor: z.string().max(2048).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
});
const cursorSchema = z.strictObject({ scope: z.string().max(1024), after: z.unknown() });
/** @internal Scope-bound cursors are continuation state, never authorization. */
export function domainCursor(scope: string, cursor?: string) {
	if (cursor === undefined) return undefined;
	if (!/^[A-Za-z0-9_-]+$/u.test(cursor) || cursor.length > 2048)
		throw new TypeError("Invalid catalog continuation cursor");
	let raw: unknown;
	try {
		raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
	} catch {
		throw new TypeError("Invalid catalog continuation cursor");
	}
	const parsed = cursorSchema.safeParse(raw);
	if (!parsed.success) throw new TypeError("Invalid catalog continuation cursor");
	const value = parsed.data;
	if (value.scope !== scope) throw new TypeError("Catalog cursor belongs to another collection");
	return value.after;
}
export function decodeDomainCursor<T extends z.ZodType>(
	scope: string,
	cursor: string | undefined,
	schema: T,
): z.output<T> | undefined {
	const value = domainCursor(scope, cursor);
	if (value === undefined) return undefined;
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new TypeError("Invalid catalog continuation value");
	return parsed.data;
}
export function encodeDomainCursor(scope: string, after: unknown) {
	return Buffer.from(JSON.stringify({ scope, after })).toString("base64url");
}
/** @internal Every domain page has a finite row and serialized-byte bound. */
export function domainPage<T>(
	scope: string,
	rows: T[],
	limit: number,
	key: (row: T) => unknown,
	hasMore = rows.length === limit,
) {
	const items: T[] = [];
	let bytes = 128;
	for (const row of rows) {
		const size = Buffer.byteLength(JSON.stringify(row));
		if (bytes + size > 2_000_000) {
			if (!items.length) throw new RangeError("Catalog record exceeds its response budget");
			break;
		}
		items.push(row);
		bytes += size;
	}
	const last = items.at(-1);
	return {
		items,
		nextCursor:
			last && (hasMore || items.length < rows.length) ? encodeDomainCursor(scope, key(last)) : null,
	};
}
