import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;

export const enContent = {
	nav: {
		home: "Home",
		how: "How it works",
		uses: "Uses",
		products: "Capabilities",
		enter: `Enter ${BRAND}`,
		language: "Language",
		theme: "Appearance",
		openMenu: "Open menu",
		closeMenu: "Close menu",
	},
	theme: { light: "Light", dark: "Dark", toggle: "Toggle appearance" },
	a11y: {
		skipContent: "Skip to main content",
		primaryNavigation: "Primary navigation",
		utilityNavigation: "Utilities",
		home: `${BRAND} home`,
	},
	meta: {
		home: {
			title: `${BRAND} — Meet the stories you love`,
			description:
				"One work identity connects releases, content, communities, and knowledge across languages.",
		},
		how: {
			title: `How it works — ${BRAND}`,
			description: `Start with work identity and see how ${BRAND} connects content, history, and communities.`,
		},
		uses: {
			title: `Uses — ${BRAND}`,
			description:
				"See how readers, communities, creators, and developers use one network for works.",
		},
		products: {
			title: `Capabilities — ${BRAND}`,
			description: `Browse the complete ${BRAND} model for works, content, communities, and open access.`,
		},
	},
	home: {
		eyebrow: "inherited · create · spread",
		title: "Meet the stories you love.",
		lead: `${BRAND} is a content organization, publishing, and community collaboration platform built for multilingual use from the ground up. It gives works, ${enTerminology.metadata.forms.inline}, ${enTerminology.post.forms.plural}, collections, classifications, and community spaces their own stable identities, so they can be connected, created, managed, discovered, discussed, and governed in one system.`,
		explore: "Explore uses",
		understand: "Understand the model",
		problem: {
			title: "We love the same work, yet keep finding fragments.",
			body: "Names, editions, media forms, and communities create separate entries. Readers identify the same thing repeatedly, attribution fades, and accumulated knowledge struggles to survive the next platform.",
		},
		promise: {
			title: "Identify the work first. Let knowledge grow around it.",
			body: `${BRAND} begins with a stable work identity. Names can be translated, content can evolve, and communities can organize different views while still referring to one understandable, traceable subject.`,
		},
		principles: [
			{
				title: "Inherited",
				body: "The history, languages, releases, and community memory a work already carries.",
			},
			{
				title: "Create",
				body: "Write content, compose structure, record attribution, and form new understanding.",
			},
			{
				title: "Spread",
				body: "Let knowledge continue through communities, open protocols, and cross-language connections.",
			},
		],
		model: {
			title: "One identity becomes a complete context, layer by layer.",
			body: "The model separates meanings that should not be collapsed, then connects them through explicit relationships.",
			steps: [
				{
					title: "Work identity",
					body: "A Unit gives the work a stable core that does not change with language or presentation.",
				},
				{
					title: "Releases and relationships",
					body: `Series, releases, ${enTerminology.entity.forms.plural}, tags, and attribution place the work in its real context.`,
				},
				{
					title: "Content and history",
					body: "Content Structure, editing, and history preserve order, change, and reuse.",
				},
				{
					title: "People and communities",
					body: `Collections, ${enTerminology.realm.forms.pluralLabel}, ${enTerminology.zone.forms.pluralLabel}, and feeds turn the model into everyday experience.`,
				},
			],
		},
		outcomes: {
			title: "For readers—and for the works themselves.",
			body: "The same foundation lowers discovery costs, preserves creative attribution, and helps works find the right readers.",
			cards: [
				{
					title: "Find",
					body: "Recognize works, releases, and creators across languages without rebuilding the puzzle.",
				},
				{
					title: "Understand",
					body: "Trace structure, reviews, wikis, history, and relationships into the work’s full context.",
				},
				{
					title: "Continue",
					body: "Keep progress, join communities, and add knowledge so personal experience can become shared memory.",
				},
			],
		},
		open: {
			title: "Openness is how memory continues.",
			body: `${BRAND} connects external tools through open source, portable content, publication licenses, and permissioned ${API}s. Shared knowledge does not have to remain trapped in one interface.`,
		},
		closing: {
			title: "Begin with one work that matters to you.",
			body: "Enter the main experience and explore works, communities, and knowledge taking shape.",
			action: `Enter ${BRAND}`,
		},
		contact: {
			title: "Have an idea worth building together?",
			body: "Whether it’s a product collaboration, an open-source contribution, a content-model question, or something that could work better, we’d like to hear from you.",
			action: "Contact us",
		},
	},
	how: {
		eyebrow: "From the foundation",
		title: "Not a larger directory—a way for works to stay connected.",
		lead: `${BRAND} builds from identity through presentation, relationships, content, trust, and discovery. Each layer keeps one meaning, which lets the whole system extend across languages, media, and communities.`,
		stages: [
			{
				title: "1. Unit: work identity",
				body: `A stable ${verbatimTerms.id.value} identifies the work. Localized names and type ${enTerminology.metadata.forms.inline} can evolve without creating another work.`,
			},
			{
				title: "2. Presentation and type",
				body: "Books, media, software, and other types keep their own fields and experiences while sharing identity and relationships.",
			},
			{
				title: "3. Relationships and attribution",
				body: `Series, releases, ${enTerminology.entity.forms.plural}, tags, creative attribution, and subject associations form an intelligible network.`,
			},
			{
				title: "4. Blocks and Content Structure",
				body: "Blocks express renderable content. Content Structure manages occurrence, order, reuse, and branching; neither impersonates the other.",
			},
			{
				title: "5. History, licensing, and governance",
				body: "Publication boundaries create traceable versions. Licenses, access rules, and community governance explain authority and trust.",
			},
			{
				title: "6. Discovery surfaces",
				body: `Search, feeds, ${enTerminology.realm.forms.pluralLabel}, and ${enTerminology.zone.forms.pluralLabel} turn the network into paths for finding, reading, joining, and returning.`,
			},
		],
		integrity: {
			title: "Keep meanings separate; connect them to create value.",
			body: "Identity is not a title, a release is not a series, a content block is not a structure node, and a community space does not own every work it references. Clear boundaries make links explainable.",
		},
		interfaceTitle: "The same model appears in a real product surface.",
		interfaceBody: `The public ${BRAND} ${enTerminology.realm.forms.inline} page combines search, community context, a content feed, and entrances to works. The image comes from a public first-party page and contains no personal account data.`,
		screenshotAlt: `Public ${BRAND} ${enTerminology.realm.forms.inline} page with navigation, search, a ${enTerminology.realm.forms.inline} heading, and first-party content cards.`,
		screenshotCaption: `Public product surface · official ${BRAND} ${enTerminology.realm.forms.inline}`,
	},
	uses: {
		eyebrow: "Start with the need",
		title: "One network for works, many real journeys.",
		lead: `Readers do not need to learn the data model first. They begin by finding a book, ${enTerminology.follow.forms.gerund} a series, joining a community, or saving progress; the underlying connections appear when useful.`,
		resultLabel: "Result",
		journeys: [
			{
				title: "Find the same work across languages",
				body: "Begin with a translation, original title, creator, release, or media form and reveal the relationships step by step.",
				result: "One trustworthy entrance instead of another repeated search.",
			},
			{
				title: "Understand editions and creative context",
				body: `See series, releases, ${enTerminology.entity.forms.plural}, characters, creators, and publishers without flattening every difference.`,
				result: "Know what you are looking at and where it came from.",
			},
			{
				title: "Read and contribute",
				body: `Read along the book structure, ${enTerminology.post.forms.plural}, wikis, pictures, reviews, and scores, then add your own understanding.`,
				result: "Content remains connected to the work it explains.",
			},
			{
				title: "Join a community of interest",
				body: `Form shared rules in a ${enTerminology.realm.forms.inline}; curate a view in a ${enTerminology.zone.forms.inline}; continue discussion through feeds.`,
				result: "Community knowledge becomes more than a disappearing message stream.",
			},
			{
				title: "Collect, return, and continue",
				body: "Organize works in collections and libraries, keep progress, and return to the same context later.",
				result: "Personal journeys and shared knowledge support each other.",
			},
			{
				title: "Publish with attribution and terms",
				body: "Creators and organizations compose content, record contributions, choose publication licenses, and preserve history.",
				result: "A work can be understood and reused without losing its origins.",
			},
			{
				title: "Build tools and new entrances",
				body: `Use ${API}, ${OAUTH}, and scoped tokens to connect search, editing, or community workflows to the same identities.`,
				result: "Integrations extend the network instead of creating new data islands.",
			},
		],
		closing: {
			title: "Want to see how every capability fits?",
			body: "The complete reference runs from work identity to open interfaces, with value, workflow, relationships, and boundaries for each part.",
			action: "Browse all capabilities",
		},
	},
	products: {
		eyebrow: "Complete reference",
		title: "From work identity to an open ecosystem.",
		lead: "Twenty-six capabilities are arranged by their place in the model. This is not a bag of unrelated features; it is a path from identifying a work to sustaining shared knowledge.",
		searchLabel: "Search capabilities",
		searchPlaceholder: "Search by name or purpose",
		allLayers: "All",
		empty: "No capabilities match.",
		openProduct: "View capability",
		layers: {
			identity: {
				title: "Identity and relationships",
				body: `Identify works and connect releases, series, ${enTerminology.entity.forms.plural}, and classification.`,
			},
			form: {
				title: "Content forms",
				body: "Carry reading, viewing, creation, reviews, and responses.",
			},
			structure: {
				title: "Structure and memory",
				body: "Compose content and preserve publication, difference, and evolution.",
			},
			community: {
				title: "People and communities",
				body: `Collect, curate, discuss, ${enTerminology.follow.forms.action}, and return.`,
			},
			open: {
				title: "Open ecosystem",
				body: "Connect tools, services, and new entrances with explicit authority.",
			},
		},
	},
	product: {
		breadcrumbHome: "Home",
		breadcrumbProducts: "Capabilities",
		layerLabel: "Layer",
		related: "Related capabilities",
		readNext: "Continue understanding",
		enter: `Enter ${BRAND}`,
	},
	footer: {
		statement:
			"Meet the stories you love. Let shared knowledge be inherited, created, and spread.",
		explore: "Explore",
		project: "Project",
		source: `${GITHUB} source`,
		mainSite: "Main site",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "Page not found",
		body: "The address may have changed, or this content does not exist.",
		back: "Back home",
	},
} satisfies SiteCopy;
