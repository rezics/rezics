export const PRODUCT_FAMILY_IDS = ["discover", "create", "continue", "open"] as const;

export type ProductFamilyId = (typeof PRODUCT_FAMILY_IDS)[number];

export type ProductClass = "surface" | "capability" | "manifestation";

export type ImplementationStatus = "implemented" | "documented" | "planned" | "research";

export type ProductDemoKind = "gamebook" | "structure" | "history";

export type ProductDefinition = {
	readonly id: string;
	readonly slug: string;
	readonly family: ProductFamilyId;
	readonly pageClass: ProductClass;
	readonly implementationStatus: ImplementationStatus;
	readonly relatedProductIds: readonly string[];
	readonly canonicalParentId?: string;
	readonly demoKind?: ProductDemoKind;
};

export type AboutPageMeta = {
	readonly title: string;
	readonly description: string;
};
