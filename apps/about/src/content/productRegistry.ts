import type { ProductDefinition, ProductLayerId } from "./productTypes";

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

const defineProduct = (definition: ProductDefinition<ProductId>): ProductDefinition<ProductId> =>
	definition;

export const PRODUCT_DEFINITIONS = [
	defineProduct({
		id: "unit",
		slug: "unit",
		layer: "identity",
		relatedProductIds: ["book", "media", "software", "series", "release", "entity", "tag"],
	}),
	defineProduct({
		id: "entity",
		slug: "entity",
		layer: "identity",
		relatedProductIds: ["unit", "book", "post", "history"],
	}),
	defineProduct({
		id: "tag",
		slug: "tag",
		layer: "identity",
		relatedProductIds: ["unit", "post", "collection", "realm", "zone"],
	}),
	defineProduct({
		id: "series",
		slug: "series",
		layer: "identity",
		relatedProductIds: ["unit", "book", "media", "release"],
	}),
	defineProduct({
		id: "release",
		slug: "release",
		layer: "identity",
		relatedProductIds: ["unit", "book", "media", "software", "series"],
	}),
	defineProduct({
		id: "book",
		slug: "book",
		layer: "form",
		relatedProductIds: ["unit", "gamebook", "release", "content-structure", "entity"],
	}),
	defineProduct({
		id: "gamebook",
		slug: "gamebook",
		layer: "form",
		canonicalParentId: "book",
		relatedProductIds: ["book", "content-structure", "progress", "history"],
	}),
	defineProduct({
		id: "media",
		slug: "media",
		layer: "form",
		relatedProductIds: ["unit", "series", "release", "entity", "tag"],
	}),
	defineProduct({
		id: "software",
		slug: "software",
		layer: "form",
		relatedProductIds: ["unit", "release", "series", "entity", "tag"],
	}),
	defineProduct({
		id: "post",
		slug: "post",
		layer: "form",
		relatedProductIds: ["wiki", "picture", "review", "editor", "history", "entity"],
	}),
	defineProduct({
		id: "wiki",
		slug: "wiki",
		layer: "form",
		canonicalParentId: "post",
		relatedProductIds: ["post", "picture", "review", "editor", "history"],
	}),
	defineProduct({
		id: "picture",
		slug: "picture",
		layer: "form",
		canonicalParentId: "post",
		relatedProductIds: ["post", "wiki", "review", "entity", "tag"],
	}),
	defineProduct({
		id: "review",
		slug: "review",
		layer: "form",
		canonicalParentId: "post",
		relatedProductIds: ["post", "score", "comment", "entity", "feed"],
	}),
	defineProduct({
		id: "comment",
		slug: "comment",
		layer: "form",
		relatedProductIds: ["post", "review", "feed", "history"],
	}),
	defineProduct({
		id: "score",
		slug: "score",
		layer: "form",
		relatedProductIds: ["review", "unit", "feed", "history"],
	}),
	defineProduct({
		id: "content-structure",
		slug: "content-structure",
		layer: "structure",
		relatedProductIds: ["book", "gamebook", "post", "editor", "history"],
	}),
	defineProduct({
		id: "editor",
		slug: "editor",
		layer: "structure",
		relatedProductIds: ["post", "book", "content-structure", "history", "api-oauth"],
	}),
	defineProduct({
		id: "history",
		slug: "history",
		layer: "structure",
		relatedProductIds: ["book", "post", "zone", "content-structure", "editor"],
	}),
	defineProduct({
		id: "collection",
		slug: "collection",
		layer: "community",
		relatedProductIds: ["library", "unit", "progress", "realm", "tag"],
	}),
	defineProduct({
		id: "library",
		slug: "library",
		layer: "community",
		canonicalParentId: "collection",
		relatedProductIds: ["collection", "book", "unit", "progress"],
	}),
	defineProduct({
		id: "realm",
		slug: "realm",
		layer: "community",
		relatedProductIds: ["zone", "feed", "collection", "unit", "tag"],
	}),
	defineProduct({
		id: "zone",
		slug: "zone",
		layer: "community",
		relatedProductIds: ["realm", "feed", "collection", "tag", "history"],
	}),
	defineProduct({
		id: "feed",
		slug: "feed",
		layer: "community",
		relatedProductIds: ["realm", "zone", "post", "comment", "tag"],
	}),
	defineProduct({
		id: "progress",
		slug: "progress",
		layer: "community",
		relatedProductIds: ["book", "gamebook", "library", "history"],
	}),
	defineProduct({
		id: "api-oauth",
		slug: "api-oauth",
		layer: "open",
		relatedProductIds: ["token", "content-structure", "editor", "feed", "entity"],
	}),
	defineProduct({
		id: "token",
		slug: "token",
		layer: "open",
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

export const PRODUCTS_BY_LAYER = {
	identity: PRODUCT_DEFINITIONS.filter((product) => product.layer === "identity"),
	form: PRODUCT_DEFINITIONS.filter((product) => product.layer === "form"),
	structure: PRODUCT_DEFINITIONS.filter((product) => product.layer === "structure"),
	community: PRODUCT_DEFINITIONS.filter((product) => product.layer === "community"),
	open: PRODUCT_DEFINITIONS.filter((product) => product.layer === "open"),
} as const satisfies Record<ProductLayerId, readonly RegisteredProduct[]>;

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

export function getProductsByLayer(layer: ProductLayerId): readonly RegisteredProduct[] {
	return PRODUCTS_BY_LAYER[layer];
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
