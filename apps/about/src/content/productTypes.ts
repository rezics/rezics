export const PRODUCT_LAYER_IDS = ["identity", "form", "structure", "community", "open"] as const;

export type ProductLayerId = (typeof PRODUCT_LAYER_IDS)[number];

export const PRODUCT_STAGE_IDS = ["available", "development", "planned"] as const;

export type ProductStageId = (typeof PRODUCT_STAGE_IDS)[number];

export type ProductDefinition<ProductId extends string = string> = {
	readonly id: ProductId;
	readonly slug: string;
	readonly layer: ProductLayerId;
	readonly stage: ProductStageId;
	readonly relatedProductIds: readonly ProductId[];
	readonly canonicalParentId?: ProductId;
};

export type AboutPageMeta = {
	readonly title: string;
	readonly description: string;
};
