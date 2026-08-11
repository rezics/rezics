import type { AboutPageMeta, ProductStageId } from "../productTypes";

type CardCopy = { readonly title: string; readonly body: string };
type JourneyCopy = CardCopy & { readonly result: string };
type ActionCardCopy = CardCopy & { readonly action: string };

type ProductStageCopy = {
	readonly legend: string;
	readonly current: string;
	readonly labels: Record<ProductStageId, string>;
};

type HomeV1Copy = {
	readonly identity: CardCopy & {
		readonly sourcesTitle: string;
		readonly sources: readonly string[];
		readonly namesTitle: string;
		readonly originalName: string;
		readonly translatedName: string;
		readonly updates: CardCopy;
		readonly progress: CardCopy;
		readonly realm: CardCopy;
		readonly workTitle: string;
	};
	readonly loop: CardCopy & { readonly steps: readonly CardCopy[] };
	readonly foundation: CardCopy & {
		readonly pillars: readonly CardCopy[];
		readonly closing: string;
	};
};

export type MainPageId = "home" | "uses" | "products";
export type PageId = MainPageId | "contact" | "legal" | "docs";

export type SiteCopy = {
	readonly nav: {
		readonly home: string;
		readonly uses: string;
		readonly products: string;
		readonly enter: string;
		readonly language: string;
		readonly theme: string;
		readonly openMenu: string;
		readonly closeMenu: string;
	};
	readonly theme: {
		readonly light: string;
		readonly dark: string;
		readonly toggle: string;
	};
	readonly a11y: {
		readonly skipContent: string;
		readonly primaryNavigation: string;
		readonly utilityNavigation: string;
		readonly home: string;
	};
	readonly meta: Record<MainPageId, AboutPageMeta>;
	readonly home: {
		readonly eyebrow: string;
		readonly title: string;
		readonly lead: string;
		readonly explore: string;
		readonly productsAction: string;
		readonly problem: CardCopy;
		readonly promise: CardCopy;
		readonly principles: readonly CardCopy[];
		readonly model: CardCopy & { readonly steps: readonly CardCopy[] };
		readonly outcomes: CardCopy & { readonly cards: readonly CardCopy[] };
		readonly open: CardCopy;
		readonly closing: ActionCardCopy;
		readonly contact: ActionCardCopy;
		readonly v1: HomeV1Copy;
	};
	readonly uses: {
		readonly eyebrow: string;
		readonly title: string;
		readonly lead: string;
		readonly resultLabel: string;
		readonly journeys: readonly JourneyCopy[];
		readonly closing: ActionCardCopy;
	};
	readonly products: {
		readonly eyebrow: string;
		readonly title: string;
		readonly lead: string;
		readonly openProduct: string;
		readonly stage: ProductStageCopy;
	};
	readonly product: {
		readonly breadcrumbHome: string;
		readonly breadcrumbProducts: string;
		readonly related: string;
		readonly readNext: string;
		readonly enter: string;
	};
	readonly footer: {
		readonly statement: string;
		readonly explore: string;
		readonly project: string;
		readonly source: string;
		readonly mainSite: string;
		readonly copyright: string;
		readonly license: string;
	};
	readonly notFound: {
		readonly title: string;
		readonly body: string;
		readonly back: string;
	};
};

export type ContactCopy = {
	readonly meta: AboutPageMeta;
	readonly hero: {
		readonly title: string;
		readonly description: string;
	};
	readonly topicsTitle: string;
	readonly topics: readonly CardCopy[];
	readonly maintainer: {
		readonly title: string;
		readonly description: string;
		readonly name: string;
		readonly role: string;
		readonly emailLabel: string;
		readonly email: string;
		readonly githubLabel: string;
		readonly sendEmail: string;
	};
};
