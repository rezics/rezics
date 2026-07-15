import type { AboutLocale } from "../i18n/locales";

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

export type LocalizedProductCopy = {
	summary: string;
	value: string;
	scenarioLead: string;
	workflowLead: string;
	boundaryLead: string;
	faq: readonly { question: string; answer: string }[];
};

export type AboutPageMeta = { title: string; description: string };

export type SiteCopy = {
	nav: {
		products: string;
		platform: string;
		history: string;
		docs: string;
		github: string;
		language: string;
		theme: string;
		openMenu: string;
		closeMenu: string;
	};
	theme: { light: string; dark: string; toggle: string };
	status: Record<ImplementationStatus, string>;
	classes: Record<ProductClass, string>;
	common: {
		conceptPreview: string;
		conceptCaption: string;
		viewProduct: string;
		viewAll: string;
		learnMore: string;
		documentation: string;
		sourceCode: string;
		relatedProducts: string;
		usedCapabilities: string;
		noParent: string;
		parentProduct: string;
		sourceBasis: string;
	};
	home: {
		meta: AboutPageMeta;
		eyebrow: string;
		title: string;
		lead: string;
		stageTitle: string;
		stageLead: string;
		productsTitle: string;
		productsLead: string;
		platformTitle: string;
		platformLead: string;
		formulaTitle: string;
		formulaLead: string;
		historyTitle: string;
		historyLead: string;
		openTitle: string;
		openLead: string;
	};
	directory: {
		meta: AboutPageMeta;
		eyebrow: string;
		title: string;
		lead: string;
		productsTitle: string;
		platformTitle: string;
		previewInstruction: string;
	};
	product: {
		breadcrumbsHome: string;
		breadcrumbsProducts: string;
		scenarios: string;
		workflow: string;
		capabilities: string;
		boundaries: string;
		faq: string;
		statusLabel: string;
		classificationLabel: string;
		structureTree: string;
		structureGame: string;
		credit: string;
		subject: string;
		publishedVersions: string;
		fieldHistory: string;
		lockScope: string;
		consumers: string;
	};
	footer: {
		statement: string;
		productLinks: string;
		platformLinks: string;
		openLinks: string;
	};
	notFound: { title: string; body: string; back: string };
};

export type LocalizedProductCopyMap = Record<AboutLocale, Record<string, LocalizedProductCopy>>;
