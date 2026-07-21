import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	siteName: String(verbatimTerms.rezics.value),
	nav: {
		products: "Products",
		platform: "Platform",
		history: "History",
		docs: "Docs",
		github: String(verbatimTerms.github.value),
		language: "Language",
		theme: "Theme",
		openMenu: "Open menu",
		closeMenu: "Close menu",
	},
	theme: {
		light: "Light",
		dark: "Dark",
		toggle: "Toggle color theme",
	},
	status: {
		implemented: "Implemented",
		documented: "Documented design",
		planned: "Planned",
		research: "Research",
	},
	classes: {
		surface: "Product surface",
		capability: "Shared capability",
		manifestation: "Product manifestation",
		protocol: "Internal protocol",
	},
	labels: {
		conceptPreview: "Concept preview",
		conceptCaption:
			"A replaceable, code-native product stage that can later be swapped for a same-size real screenshot.",
		viewProduct: "View product",
		viewAll: "View all",
		learnMore: "Learn more",
		documentation: `${verbatimTerms.outline.value} docs`,
		sourceCode: "Source code",
		relatedProducts: "Related products",
		usedCapabilities: "Shared capabilities used",
		noParent: "Independent product with no carrier parent",
		parentProduct: "Parent product",
		sourceBasis: "Fact sources",
	},
	footer: {
		statement: `${verbatimTerms.rezics.value} is an open product system built around content identity, structure, and history.`,
		productLinks: "Products",
		platformLinks: "Platform",
		openLinks: "Open",
		implementation: `${verbatimTerms.agpl30.value} · Static site built with ${verbatimTerms.vike.value} and ${verbatimTerms.react.value}`,
	},
	notFound: {
		title: "Page not found",
		body: "This link may have moved or may not be a public product page.",
		back: "Back home",
	},
	a11y: {
		home: `${verbatimTerms.rezics.value} home`,
		skipContent: "Skip to main content",
		primaryNavigation: "Primary navigation",
		mobileNavigation: "Mobile navigation",
		breadcrumb: "Breadcrumb",
		modes: "Modes",
	},
};

export default content;
