import { type Static, Type } from "@sinclair/typebox";

/** Stable sibling-local identity; position is deliberately not identity. */
export const BlockKey = Type.String({ pattern: "^[0-9a-f]{12}$", $id: "BlockKey" });
export type BlockKey = Static<typeof BlockKey>;

export function createBlockKey(): BlockKey {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
