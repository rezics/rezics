import type { ProductDefinition, ProductFamilyId } from "./productTypes";

const defineProduct = <const T extends ProductDefinition>(definition: T): T => definition;

export const PRODUCT_DEFINITIONS = [
	defineProduct({
		id: "catalog",
		slug: "catalog",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["book", "media", "software", "series", "release", "entity", "tag"],
	}),
	defineProduct({
		id: "book",
		slug: "book",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["catalog", "gamebook", "release", "content-structure", "entity"],
	}),
	defineProduct({
		id: "gamebook",
		slug: "gamebook",
		family: "discover",
		pageClass: "manifestation",
		implementationStatus: "documented",
		canonicalParentId: "book",
		demoKind: "gamebook",
		relatedProductIds: ["book", "content-structure", "progress", "history"],
	}),
	defineProduct({
		id: "media",
		slug: "media",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["catalog", "series", "release", "entity", "tag"],
	}),
	defineProduct({
		id: "software",
		slug: "software",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["catalog", "release", "series", "entity", "tag"],
	}),
	defineProduct({
		id: "series",
		slug: "series",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["catalog", "book", "media", "software", "release"],
	}),
	defineProduct({
		id: "release",
		slug: "release",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["catalog", "book", "media", "software", "series"],
	}),
	defineProduct({
		id: "entity",
		slug: "entity",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "implemented",
		relatedProductIds: ["book", "post", "media", "software", "history"],
	}),
	defineProduct({
		id: "tag",
		slug: "tag",
		family: "discover",
		pageClass: "surface",
		implementationStatus: "implemented",
		relatedProductIds: ["catalog", "post", "collection", "realm", "zone"],
	}),
	defineProduct({
		id: "post",
		slug: "post",
		family: "create",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["wiki", "picture", "review", "editor", "history", "entity"],
	}),
	defineProduct({
		id: "wiki",
		slug: "wiki",
		family: "create",
		pageClass: "manifestation",
		implementationStatus: "documented",
		canonicalParentId: "post",
		relatedProductIds: ["post", "picture", "review", "editor", "history"],
	}),
	defineProduct({
		id: "picture",
		slug: "picture",
		family: "create",
		pageClass: "manifestation",
		implementationStatus: "documented",
		canonicalParentId: "post",
		relatedProductIds: ["post", "wiki", "review", "entity", "tag"],
	}),
	defineProduct({
		id: "review",
		slug: "review",
		family: "create",
		pageClass: "manifestation",
		implementationStatus: "documented",
		canonicalParentId: "post",
		relatedProductIds: ["post", "score", "comment", "entity", "feed"],
	}),
	defineProduct({
		id: "comment",
		slug: "comment",
		family: "create",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["post", "review", "feed", "history"],
	}),
	defineProduct({
		id: "score",
		slug: "score",
		family: "create",
		pageClass: "surface",
		implementationStatus: "documented",
		relatedProductIds: ["review", "catalog", "feed", "history"],
	}),
	defineProduct({
		id: "content-structure",
		slug: "content-structure",
		family: "create",
		pageClass: "surface",
		implementationStatus: "implemented",
		demoKind: "structure",
		relatedProductIds: ["book", "gamebook", "post", "editor", "history"],
	}),
	defineProduct({
		id: "editor",
		slug: "editor",
		family: "create",
		pageClass: "capability",
		implementationStatus: "documented",
		relatedProductIds: ["post", "book", "content-structure", "history", "api-oauth"],
	}),
	defineProduct({
		id: "collection",
		slug: "collection",
		family: "continue",
		pageClass: "surface",
		implementationStatus: "implemented",
		relatedProductIds: ["library", "catalog", "progress", "realm", "tag"],
	}),
	defineProduct({
		id: "library",
		slug: "library",
		family: "continue",
		pageClass: "manifestation",
		implementationStatus: "planned",
		canonicalParentId: "collection",
		relatedProductIds: ["collection", "book", "catalog", "progress"],
	}),
	defineProduct({
		id: "realm",
		slug: "realm",
		family: "continue",
		pageClass: "surface",
		implementationStatus: "implemented",
		relatedProductIds: ["zone", "feed", "collection", "catalog", "tag"],
	}),
	defineProduct({
		id: "zone",
		slug: "zone",
		family: "continue",
		pageClass: "surface",
		implementationStatus: "implemented",
		relatedProductIds: ["realm", "feed", "collection", "tag", "history"],
	}),
	defineProduct({
		id: "feed",
		slug: "feed",
		family: "continue",
		pageClass: "capability",
		implementationStatus: "documented",
		relatedProductIds: ["realm", "zone", "post", "comment", "tag"],
	}),
	defineProduct({
		id: "progress",
		slug: "progress",
		family: "continue",
		pageClass: "capability",
		implementationStatus: "planned",
		relatedProductIds: ["book", "gamebook", "library", "history"],
	}),
	defineProduct({
		id: "history",
		slug: "history",
		family: "open",
		pageClass: "capability",
		implementationStatus: "documented",
		demoKind: "history",
		relatedProductIds: ["book", "post", "zone", "content-structure", "editor"],
	}),
	defineProduct({
		id: "api-oauth",
		slug: "api-oauth",
		family: "open",
		pageClass: "capability",
		implementationStatus: "documented",
		relatedProductIds: ["token", "content-structure", "editor", "feed", "entity"],
	}),
	defineProduct({
		id: "token",
		slug: "token",
		family: "open",
		pageClass: "capability",
		implementationStatus: "implemented",
		relatedProductIds: ["api-oauth", "content-structure", "editor", "catalog"],
	}),
] as const;

export type ProductId = (typeof PRODUCT_DEFINITIONS)[number]["id"];
export type ProductSlug = (typeof PRODUCT_DEFINITIONS)[number]["slug"];
export type RegisteredProduct = ProductDefinition & {
	readonly id: ProductId;
	readonly slug: ProductSlug;
};

const productById = new Map<ProductId, RegisteredProduct>(
	PRODUCT_DEFINITIONS.map((product) => [product.id, product]),
);

const productBySlug = new Map<ProductSlug, RegisteredProduct>(
	PRODUCT_DEFINITIONS.map((product) => [product.slug, product]),
);

export const PRODUCT_FAMILIES = {
	discover: PRODUCT_DEFINITIONS.filter((product) => product.family === "discover"),
	create: PRODUCT_DEFINITIONS.filter((product) => product.family === "create"),
	continue: PRODUCT_DEFINITIONS.filter((product) => product.family === "continue"),
	open: PRODUCT_DEFINITIONS.filter((product) => product.family === "open"),
} as const satisfies Record<ProductFamilyId, readonly ProductDefinition[]>;

const productIdSet: ReadonlySet<string> = new Set(productById.keys());
const productSlugSet: ReadonlySet<string> = new Set(productBySlug.keys());

export function isProductId(value: string): value is ProductId {
	return productIdSet.has(value);
}

export function isProductSlug(value: string): value is ProductSlug {
	return productSlugSet.has(value);
}

export function getProductById(id: ProductId): RegisteredProduct {
	const product = productById.get(id);
	if (!product) throw new Error(`Registered product is missing: ${id}`);
	return product;
}

export function getProductBySlug(slug: ProductSlug): RegisteredProduct {
	const product = productBySlug.get(slug);
	if (!product) throw new Error(`Registered product slug is missing: ${slug}`);
	return product;
}

export function getProductsByFamily(familyId: ProductFamilyId): readonly RegisteredProduct[] {
	return PRODUCT_FAMILIES[familyId];
}

export function getRelatedProducts(product: ProductDefinition): RegisteredProduct[] {
	return product.relatedProductIds.flatMap((id) => {
		if (!isProductId(id)) return [];
		return [getProductById(id)];
	});
}

export function getParentProduct(product: ProductDefinition): RegisteredProduct | undefined {
	const parentId = product.canonicalParentId;
	return parentId && isProductId(parentId) ? getProductById(parentId) : undefined;
}
