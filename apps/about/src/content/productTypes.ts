export type ProductClass = "surface" | "capability" | "manifestation" | "protocol";
export type ProductNavGroup = "products" | "platform";
export type ImplementationStatus = "implemented" | "documented" | "planned" | "research";
export type ProductDemoKind =
	| "book"
	| "gamebook"
	| "structure"
	| "history"
	| "attribution"
	| "zone"
	| "feed"
	| "catalog"
	| "editor"
	| "progress"
	| "generic";

export type ProductClaim = {
	id: string;
	productId: string;
	sourceType: "user-confirmed" | "outline" | "schema";
	sourceReference: string;
	status: "confirmed" | "planned" | "research";
};

export type ProductManifestation = { formula: string; description: string };

export type ProductSectionId =
	| "identity"
	| "stage"
	| "scenarios"
	| "workflow"
	| "capabilities"
	| "boundaries"
	| "faq"
	| "related";

export type ProductDefinition = {
	id: string;
	slug: string;
	name: string;
	pageClass: ProductClass;
	navGroup: ProductNavGroup;
	canonicalParentId?: string;
	capabilityModes?: readonly string[];
	consumesCapabilities: readonly string[];
	manifestation?: ProductManifestation;
	relatedProductIds: readonly string[];
	implementationStatus: ImplementationStatus;
	sourceDocuments: readonly string[];
	mediaIds: readonly string[];
	demoKind: ProductDemoKind;
	sections: readonly ProductSectionId[];
};

export type ProtocolDefinition = {
	id: string;
	name: string;
	pageClass: "protocol";
	describedByProductIds: readonly string[];
};

export type ProductMediaBase = {
	id: string;
	productId: string;
	purpose: "hero" | "workflow" | "capability" | "directory";
	fidelity: "real" | "concept";
	themes: readonly ("light" | "dark")[];
	viewports: readonly ("desktop" | "mobile")[];
	width: number;
	height: number;
	altKey: string;
	captionKey: string;
	replaceable: boolean;
	source: string;
	featureVersion: string;
};

export type ScreenshotMedia = ProductMediaBase & {
	kind: "screenshot";
	sourcePath: string;
};
export type VideoMedia = ProductMediaBase & {
	kind: "video";
	sourcePath: string;
	posterPath: string;
};
export type ConceptComponentMedia = ProductMediaBase & {
	kind: "concept-component";
	componentId: ProductDemoKind;
};
export type ProductMedia = ScreenshotMedia | VideoMedia | ConceptComponentMedia;

export type AboutPageMeta = { title: string; description: string };
