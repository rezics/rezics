import type { Static, TSchema } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import { InvalidPaginationCursor } from "./errors";

type CursorBoundary = [createdAt: string, id: string];

export function encodeCursor(createdAt: Date | string, id: string) {
	return Buffer.from(`${new Date(createdAt).toISOString()}\0${id}`).toString("base64url");
}

export function parseJsonCursor<T extends TSchema>(cursor: string, schema: T): Static<T> {
	const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString());
	if (!Check(schema, value)) throw new Error("Cursor does not match its schema");
	return value;
}

export function decodeCursor(cursor?: string) {
	if (!cursor) return undefined;
	try {
		const [createdAt, id, extra] = Buffer.from(cursor, "base64url").toString().split("\0");
		if (!createdAt || !id || extra || Number.isNaN(Date.parse(createdAt)))
			throw new InvalidPaginationCursor();
		return [createdAt, id] satisfies CursorBoundary;
	} catch {
		throw new InvalidPaginationCursor();
	}
}
