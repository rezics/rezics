import { createHash } from "node:crypto";
import { z } from "zod";

export const sourceKeySchema = z.strictObject({
	source: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
	objectType: z.string().regex(/^[a-z][a-z0-9_.-]{0,95}$/u),
	externalId: z
		.string()
		.min(1)
		.refine((value) => Buffer.byteLength(value, "utf8") <= 512),
});
export type CatalogSourceKey = z.infer<typeof sourceKeySchema>;

/** @internal Natural-key identity and partition route are identical across importers. */
export function catalogSourceRecordId(input: CatalogSourceKey): string {
	const key = sourceKeySchema.parse(input);
	const hash = createHash("sha256")
		.update(`${key.source}\n${key.objectType}\n${key.externalId}`)
		.digest("hex");
	return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

