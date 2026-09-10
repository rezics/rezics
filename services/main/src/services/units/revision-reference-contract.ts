import { z } from "zod";
import { CatalogOwnerSchema } from "@rezics/reference";

/** Complete catalog history families admitted by the initial exact-reference bridge. @internal */
export const RevisionReferenceKindValues = ["named_form", "identifier_claim"] as const;
export type RevisionReferenceKind = (typeof RevisionReferenceKindValues)[number];

/**
 * An exact owner-local catalog revision, not a current head or an identity reference.
 * @remarks These history owners bound their revision sequence to safe integers.
 * @internal
 */
export const CatalogRevisionReferenceSchema = z.strictObject({
	owner: CatalogOwnerSchema,
	kind: z.enum(RevisionReferenceKindValues),
	ownerId: z.uuid(),
	itemId: z.uuid(),
	revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export type CatalogRevisionReference = z.infer<typeof CatalogRevisionReferenceSchema>;
