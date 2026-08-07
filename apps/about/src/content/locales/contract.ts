import type { AboutPageMeta, ProductLayerId } from "../productTypes";

type CardCopy = { readonly title: string; readonly body: string };
type JourneyCopy = CardCopy & { readonly result: string };
type ActionCardCopy = CardCopy & { readonly action: string };

export type MainPageId = "home" | "how" | "uses" | "products";
export type PageId = MainPageId | "contact" | "legal" | "docs";

export type SiteCopy = {
	readonly nav: {
		readonly home: string;
		readonly how: string;
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
		readonly understand: string;
		readonly problem: CardCopy;
		readonly promise: CardCopy;
		readonly principles: readonly CardCopy[];
		readonly model: CardCopy & { readonly steps: readonly CardCopy[] };
		readonly outcomes: CardCopy & { readonly cards: readonly CardCopy[] };
		readonly open: CardCopy;
		readonly closing: ActionCardCopy;
		readonly contact: ActionCardCopy;
	};
	readonly how: {
		readonly eyebrow: string;
		readonly title: string;
		readonly lead: string;
		readonly stages: readonly CardCopy[];
		readonly integrity: CardCopy;
		readonly interfaceTitle: string;
		readonly interfaceBody: string;
		readonly screenshotAlt: string;
		readonly screenshotCaption: string;
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
		readonly searchLabel: string;
		readonly searchPlaceholder: string;
		readonly allLayers: string;
		readonly empty: string;
		readonly openProduct: string;
		readonly layers: Record<ProductLayerId, CardCopy>;
	};
	readonly product: {
		readonly breadcrumbHome: string;
		readonly breadcrumbProducts: string;
		readonly layerLabel: string;
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
