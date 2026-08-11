import type { ProductDefinition } from "./productTypes";

export const PRODUCT_IDS = [
	"unit",
	"entity",
	"tag",
	"series",
	"release",
	"book",
	"gamebook",
	"media",
	"software",
	"post",
	"wiki",
	"picture",
	"review",
	"comment",
	"score",
	"content-structure",
	"editor",
	"history",
	"collection",
	"library",
	"realm",
	"zone",
	"feed",
	"progress",
	"api-oauth",
	"token",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];

export const PRODUCT_PRESENTATION_ORDER = [
	"unit",
	"collection",
	"tag",
	"wiki",
	"realm",
	"book",
	"progress",
	"feed",
	"review",
	"comment",
	"score",
	"entity",
	"series",
	"release",
	"post",
	"content-structure",
	"editor",
	"history",
	"zone",
	"library",
	"picture",
	"media",
	"software",
	"gamebook",
	"api-oauth",
	"token",
] as const satisfies readonly ProductId[];

const defineProduct = (definition: ProductDefinition<ProductId>): ProductDefinition<ProductId> =>
	definition;

export const PRODUCT_DEFINITIONS = [
	defineProduct({
		id: "unit",
		slug: "unit",
		stage: "available",
		relatedProductIds: ["collection", "book", "post", "realm", "history", "release", "entity"],
	}),
	defineProduct({
		id: "entity",
		slug: "entity",
		stage: "available",
		relatedProductIds: ["unit", "book", "post", "history"],
	}),
	defineProduct({
		id: "tag",
		slug: "tag",
		stage: "available",
		relatedProductIds: ["unit", "post", "collection", "realm", "zone"],
	}),
	defineProduct({
		id: "series",
		slug: "series",
		stage: "available",
		relatedProductIds: ["unit", "book", "media", "release"],
	}),
	defineProduct({
		id: "release",
		slug: "release",
		stage: "available",
		relatedProductIds: ["unit", "book", "media", "software", "series"],
	}),
	defineProduct({
		id: "book",
		slug: "book",
		stage: "available",
		relatedProductIds: ["unit", "gamebook", "release", "content-structure", "entity"],
	}),
	defineProduct({
		id: "gamebook",
		slug: "gamebook",
		stage: "planned",
		canonicalParentId: "book",
		relatedProductIds: ["book", "content-structure", "progress", "history"],
	}),
	defineProduct({
		id: "media",
		slug: "media",
		stage: "available",
		relatedProductIds: ["unit", "series", "release", "entity", "tag"],
	}),
	defineProduct({
		id: "software",
		slug: "software",
		stage: "available",
		relatedProductIds: ["unit", "release", "series", "entity", "tag"],
	}),
	defineProduct({
		id: "post",
		slug: "post",
		stage: "available",
		relatedProductIds: ["wiki", "picture", "review", "editor", "history", "entity"],
	}),
	defineProduct({
		id: "wiki",
		slug: "wiki",
		stage: "development",
		canonicalParentId: "post",
		relatedProductIds: [
			"post",
			"entity",
			"zone",
			"realm",
			"editor",
			"content-structure",
			"history",
		],
	}),
	defineProduct({
		id: "picture",
		slug: "picture",
		stage: "development",
		canonicalParentId: "post",
		relatedProductIds: ["post", "wiki", "review", "entity", "tag"],
	}),
	defineProduct({
		id: "review",
		slug: "review",
		stage: "available",
		canonicalParentId: "post",
		relatedProductIds: ["post", "score", "comment", "entity", "feed"],
	}),
	defineProduct({
		id: "comment",
		slug: "comment",
		stage: "available",
		relatedProductIds: ["post", "review", "feed", "history"],
	}),
	defineProduct({
		id: "score",
		slug: "score",
		stage: "available",
		relatedProductIds: ["review", "unit", "feed", "history"],
	}),
	defineProduct({
		id: "content-structure",
		slug: "content-structure",
		stage: "available",
		relatedProductIds: ["book", "gamebook", "post", "editor", "history"],
	}),
	defineProduct({
		id: "editor",
		slug: "editor",
		stage: "available",
		relatedProductIds: ["post", "book", "content-structure", "history", "api-oauth"],
	}),
	defineProduct({
		id: "history",
		slug: "history",
		stage: "available",
		relatedProductIds: ["book", "post", "zone", "content-structure", "editor"],
	}),
	defineProduct({
		id: "collection",
		slug: "collection",
		stage: "available",
		relatedProductIds: ["unit", "book", "realm", "feed", "tag", "library", "progress"],
	}),
	defineProduct({
		id: "library",
		slug: "library",
		stage: "planned",
		canonicalParentId: "collection",
		relatedProductIds: ["collection", "book", "unit", "progress"],
	}),
	defineProduct({
		id: "realm",
		slug: "realm",
		stage: "available",
		relatedProductIds: ["zone", "feed", "collection", "unit", "tag"],
	}),
	defineProduct({
		id: "zone",
		slug: "zone",
		stage: "development",
		relatedProductIds: ["realm", "feed", "collection", "tag", "history"],
	}),
	defineProduct({
		id: "feed",
		slug: "feed",
		stage: "available",
		relatedProductIds: ["realm", "zone", "post", "comment", "tag"],
	}),
	defineProduct({
		id: "progress",
		slug: "progress",
		stage: "available",
		relatedProductIds: ["book", "gamebook", "library", "history"],
	}),
	defineProduct({
		id: "api-oauth",
		slug: "api-oauth",
		stage: "development",
		relatedProductIds: ["token", "content-structure", "editor", "feed", "entity"],
	}),
	defineProduct({
		id: "token",
		slug: "token",
		stage: "available",
		relatedProductIds: ["api-oauth", "content-structure", "editor", "unit"],
	}),
] as const;

export type RegisteredProduct = (typeof PRODUCT_DEFINITIONS)[number];
export type ProductSlug = RegisteredProduct["slug"];

const productsById = new Map<ProductId, RegisteredProduct>(
	PRODUCT_DEFINITIONS.map((product) => [product.id, product]),
);
const productsBySlug = new Map<ProductSlug, RegisteredProduct>(
	PRODUCT_DEFINITIONS.map((product) => [product.slug, product]),
);
const productIds: ReadonlySet<string> = new Set(PRODUCT_IDS);
const productSlugs: ReadonlySet<string> = new Set(PRODUCT_DEFINITIONS.map(({ slug }) => slug));

export function isProductId(value: string): value is ProductId {
	return productIds.has(value);
}

export function isProductSlug(value: string): value is ProductSlug {
	return productSlugs.has(value);
}

export function getProductById(id: ProductId): RegisteredProduct {
	const product = productsById.get(id);
	if (!product) throw new Error(`Missing registered product: ${id}`);
	return product;
}

export function getProductBySlug(slug: ProductSlug): RegisteredProduct {
	const product = productsBySlug.get(slug);
	if (!product) throw new Error(`Missing registered product slug: ${slug}`);
	return product;
}

export function validateProductRegistry(): readonly string[] {
	const errors: string[] = [];
	const ids = new Set<string>();
	const slugs = new Set<string>();

	for (const product of PRODUCT_DEFINITIONS) {
		if (ids.has(product.id)) errors.push(`Duplicate product id: ${product.id}`);
		if (slugs.has(product.slug)) errors.push(`Duplicate product slug: ${product.slug}`);
		ids.add(product.id);
		slugs.add(product.slug);
	}

	for (const id of PRODUCT_IDS) {
		if (!ids.has(id)) errors.push(`Missing product definition: ${id}`);
	}

	const presentationIds = new Set<ProductId>();
	for (const id of PRODUCT_PRESENTATION_ORDER) {
		if (presentationIds.has(id)) errors.push(`Duplicate product presentation id: ${id}`);
		presentationIds.add(id);
	}
	for (const id of PRODUCT_IDS) {
		if (!presentationIds.has(id)) errors.push(`Missing product presentation id: ${id}`);
	}

	for (const product of PRODUCT_DEFINITIONS) {
		for (const relatedId of product.relatedProductIds) {
			if (!ids.has(relatedId)) {
				errors.push(`${product.id} references unknown product ${relatedId}`);
			}
		}
		if (product.canonicalParentId && !ids.has(product.canonicalParentId)) {
			errors.push(`${product.id} has unknown parent ${product.canonicalParentId}`);
		}
	}

	return errors;
}
