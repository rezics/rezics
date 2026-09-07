import { z } from "zod";

/** Physical catalog owners, independent of semantic classes and public presentation kinds. @alpha */
export const CatalogOwnerValues = [
	"publishing",
	"music",
	"program",
	"software",
	"entity",
	"grouping",
	"reference",
	"distribution",
] as const;

/** Standalone content/platform identities retained by the target application. @alpha */
export const PlatformOwnerValues = [
	"video",
	"audio",
	"post",
	"poll",
	"zone",
	"realm",
	"realm_rule",
	"custom_theme",
	"collection",
	"tag",
	"tag_path",
	"label",
] as const;

/** Membership in this registry does not grant a capability or prove a referenced row exists. @alpha */
export const UnitOwnerValues = [...CatalogOwnerValues, ...PlatformOwnerValues] as const;
export type CatalogOwner = (typeof CatalogOwnerValues)[number];
export type PlatformOwner = (typeof PlatformOwnerValues)[number];
export type UnitOwner = (typeof UnitOwnerValues)[number];

/**
 * Serialized logical Unit reference.
 * @alpha
 * @remarks Target-contract preview for application owners and future API clients.
 * Parsing proves only owner and UUID shape. The owning service must check concrete
 * foreign keys, supported capability, current visibility and authorization.
 */
export const UnitReferenceSchema = z.strictObject({ owner: z.enum(UnitOwnerValues), id: z.uuid() });
export type UnitReference = z.infer<typeof UnitReferenceSchema>;

/** Catalog-only references cannot silently accept platform or account identities. @alpha */
export const CatalogReferenceSchema = z.strictObject({
	owner: z.enum(CatalogOwnerValues),
	id: z.uuid(),
});
export type CatalogReference = z.infer<typeof CatalogReferenceSchema>;

/** Exact observation identity; snapshot ownership and visibility require database checks. @alpha */
export const SourceObservationReferenceSchema = z.strictObject({
	sourceRecordId: z.uuid(),
	snapshotId: z.uuid(),
});
export type SourceObservationReference = z.infer<typeof SourceObservationReferenceSchema>;
