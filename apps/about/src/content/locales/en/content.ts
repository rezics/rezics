import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const BLOCK_SCHEMA = verbatimTerms.blockSchema.value;
const PORTABLE_TEXT = verbatimTerms.portableText.value;
const JSON = verbatimTerms.json.value;
const URL = verbatimTerms.url.value;
const ENTRY = verbatimTerms.entryEdge.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;
const FOLLOW = enTerminology.follow.forms.actionLabel;
const FOLLOW_ACTION = enTerminology.follow.forms.action;
const FOLLOW_GERUND = enTerminology.follow.forms.gerund;
const REALM = enTerminology.realm.forms.label;

export const enContent = {
	nav: {
		home: "Home",
		uses: "Uses",
		products: "Products",
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
		utilityNavigation: "Utility navigation",
		home: `${BRAND} home`,
	},
	meta: {
		home: {
			title: `${BRAND} — Meet the stories you love`,
			description: `Find web novels across platforms and languages, ${FOLLOW_ACTION} serials, and meet fellow readers in a ${REALM}.`,
		},
		uses: {
			title: `Uses — ${BRAND}`,
			description: `Explore how readers find books across platforms, ${FOLLOW_ACTION} serials, save progress, and meet fellow readers.`,
		},
		products: {
			title: `Products — ${BRAND}`,
			description: `Use cross-language booklists, tags and community classification, wikis, and ${REALM}s to find, understand, collect, and carry works forward.`,
		},
	},
	home: {
		eyebrow: "inherit · create · spread",
		title: "Meet the stories you love.",
		lead: `Start with web novels scattered across platforms and languages. ${BRAND} reconnects original titles, translated titles, serial sources, chapters, and communities as one evolving work.`,
		explore: "Explore web novels",
		productsAction: "Explore products",
		problem: {
			title:
				"A serial should not become fragments because of its platform, language, or translated title.",
			body: "Readers are looking for the same story, yet today they must identify it again and again across platform pages, translated-title entries, progress tools, and discussion groups. When the work updates, those fragments may not move forward together.",
		},
		promise: {
			title: "Reconnect the same work first; then let reading and community grow naturally.",
			body: `${BRAND} starts from a stable work identity. Names can cross languages, serials can cross platforms, chapters can keep growing, and ${REALM}s can form different perspectives; they still point to the same understandable, traceable work.`,
		},
		principles: [
			{
				title: "Cross-platform recognition",
				body: `A platform ${URL} is a source, not a work's only identity.`,
			},
			{
				title: "Cross-language understanding",
				body: "Original titles, translated titles, and aliases work together to help readers find the same work.",
			},
			{
				title: "Continuous evolution",
				body: "Serials, chapters, editions, progress, and discussion can all keep accumulating as a work updates.",
			},
		],
		model: {
			title: `Web novels are the ${ENTRY} point; the foundation is designed for every evolving work.`,
			body: "Works, sources, content, structure, history, and communities each keep clear boundaries, then cooperate through explicit relationships.",
			steps: [
				{
					title: "Work identity",
					body: "Cross-language names and cross-platform sources return to one governable identity.",
				},
				{
					title: "Sources and serials",
					body: `Original serials, translation sources, published editions, and update status are no longer compressed into one ${URL}.`,
				},
				{
					title: `Reading and ${FOLLOW}`,
					body: "Content Structure preserves chapter context, and progress lets readers resume from the real place.",
				},
				{
					title: `${REALM}s and shared knowledge`,
					body: `Readers build ${REALM}s around shared interests, so discussion, corrections, and discovery can endure.`,
				},
			],
		},
		outcomes: {
			title: "Solve readers' problems today, then accumulate tomorrow's work network.",
			body: `Every act of finding, ${FOLLOW_ACTION}ing, joining a community, and adding a relationship lowers the next reader's cost of searching.`,
			cards: [
				{
					title: "Find",
					body: `Find the same web novel by its original title, translated title, alias, or source ${URL}.`,
				},
				{
					title: "Continue",
					body: `${FOLLOW} serial updates and save reading status and the last position.`,
				},
				{
					title: "Meet",
					body: `Enter or create a ${REALM} to find people who want to discuss the same work over time.`,
				},
			],
		},
		open: {
			title: "A grand narrative must rest on verifiable foundations.",
			body: `${BRAND} builds boundaries that can extend over time through open source, content documents with version semantics, ${enTerminology.publicationLicense.forms.inline}s, and permissioned ${API}s. Product pages clearly distinguish what is available, in development, and planned.`,
		},
		closing: {
			title: `Start with a web novel you are ${FOLLOW_GERUND}.`,
			body: `Search for its original or translated title, save your reading context, and see whether someone has already created a ${REALM} for it.`,
			action: `Enter ${BRAND}`,
		},
		contact: {
			title: "Have an idea you want to make real with us?",
			body: "Whether it is a product collaboration, open-source participation, a content model, or any suggestion worth doing better, we would be glad to talk.",
			action: "Contact us",
		},
		v1: {
			identity: {
				title:
					"A serial should not become fragments because of its platform, language, or translated title.",
				body: `Readers are looking for the same story, yet today they must identify it again and again across platform pages, translated-title entries, progress tools, and discussion groups. ${BRAND} reconnects them to one work identity first.`,
				sourcesTitle: "Cross-platform sources",
				sources: [
					"Original serial platforms",
					"Translation and licensed sources",
					"Published and other editions",
				],
				namesTitle: "Original and translated names",
				originalName: "Original title, romanization, and aliases",
				translatedName: "Official translated titles and customary names in each language",
				updates: {
					title: "Serial updates",
					body: "Sources continue to update; work identity does not need rebuilding.",
				},
				progress: {
					title: "Reading progress",
					body: "Know where the work has updated to, and where you have read to.",
				},
				realm: {
					title: `${REALM} reader communities`,
					body: "Find people who want to discuss the work over time.",
				},
				workTitle: "One evolving work",
			},
			loop: {
				title: "From finding a book to forming a work network that is hard to reproduce.",
				body: `A 400,000-book launch catalogue solves cold start. What truly keeps accumulating is cross-platform identity, cross-language relationships, reading trails, and ${REALM} community memory.`,
				steps: [
					{
						title: "Find a work across platforms",
						body: "Original titles, translated titles, aliases, and sources point to one identity.",
					},
					{
						title: `${FOLLOW} serials and progress`,
						body: "Know where to read, where updates have reached, and where you have read to.",
					},
					{
						title: `Join or create a ${REALM}`,
						body: "Find people who genuinely discuss the work over time.",
					},
					{
						title: "Contribute sources and knowledge",
						body: "Correct names, editions, relationships, and community content.",
					},
					{
						title: "Improve search and recommendations",
						body: "Every act of participation lowers the next reader's cost of searching.",
					},
				],
			},
			foundation: {
				title: `Web novels are the ${ENTRY} point; the foundation is designed for every evolving work.`,
				body: `${BRAND} separates work identity, sources, content, structure, history, and communities into clear boundaries, then lets them cooperate through explicit relationships.`,
				pillars: [
					{
						title: "Work identity and sources",
						body: "Cross-language names, platform sources, canonical/variant records, and merge governance.",
					},
					{
						title: "Content Structure",
						body: "Chapters are reusable content; structure manages order, occurrence, and serial evolution.",
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}`,
						body: `Evolvable documents with type, key, and version semantics; rich text is not raw ${JSON}.`,
					},
					{
						title: `${REALM}s and shared memory`,
						body: "Communities do not own works, yet discussion, governance, and knowledge can accumulate over time.",
					},
				],
				closing:
					"Start with web novels and build a network where works and shared knowledge can be inherited, created, and spread.",
			},
		},
	},
	uses: {
		eyebrow: "Readers get value first",
		title: `Find books, ${FOLLOW_ACTION} updates, keep reading, then meet genuine fellow readers.`,
		lead: `Readers do not need to understand content Units, blocks, or Content Structure first. They only need to start from a familiar title, platform, or language; ${BRAND} connects the identities and relationships behind the scenes.`,
		resultLabel: "What you get",
		journeys: [
			{
				title: "Find the same web novel across platforms",
				body: `Enter from a platform ${URL}, original serial, translation source, or published edition, then return to the same work identity.`,
				result: `Stop treating every platform ${ENTRY} as a different book.`,
			},
			{
				title: "Find it in any language you know",
				body: `Original titles, romanization, official translated titles, and community names all become search ${ENTRY} points while retaining their own language context.`,
				result: "Cross languages without having to get to know the same work again.",
			},
			{
				title: `${FOLLOW} serials and resume from where you left off`,
				body: "See which chapter a source has updated to, whether the work is ongoing or complete, and save your own reading status and last position.",
				result: "The work updates; your reading context does not have to start over.",
			},
			{
				title: `Join or create a ${REALM}`,
				body: `Enter a ${REALM} from a work page and form long-term discussion and shared rules around the same work, genre, or reading preference.`,
				result: "Move from finding a work to finding genuine fellow readers.",
			},
			{
				title: "Add sources, names, and work relationships",
				body: "Help correct translated titles, platform sources, series, releases, creators, and thematic relationships while retaining governance and historical context.",
				result: "Every correction helps the next reader find an answer faster.",
			},
			{
				title: "Publish your own articles and work content",
				body: `Edit ${enTerminology.post.forms.label}s with ${PORTABLE_TEXT}, store evolvable documents with ${BLOCK_SCHEMA}, and use Content Structure to arrange chapters and publication history.`,
				result:
					"Content is not only readable; it can also be cited, reused, and revised continuously.",
			},
			{
				title: `Build new ${ENTRY} points through open interfaces`,
				body: `Developers can currently access explicit scopes through ${API} and tokens. ${OAUTH} and ${MCP} integrations will open gradually according to the stage shown on each product page.`,
				result: "What is usable now and where the next step leads are both made public.",
			},
		],
		closing: {
			title: "Want to see which products work together behind these uses?",
			body: "Each product page starts with the outcome it creates, then opens up the products involved, their current stages, and their relationships.",
			action: "Explore products",
		},
	},
	products: {
		eyebrow: "Products",
		title: "Find, understand, collect, and carry works forward together.",
		lead: `Cross-language booklists, tags and community classification, wikis, and ${REALM}s all return to the same work. Every new name, source, contribution, and community helps it keep growing.`,
		openProduct: "View product",
		stage: {
			legend: "Product status",
			current: "Current status",
			labels: { available: "Available", development: "In development", planned: "Planned" },
		},
	},
	product: {
		breadcrumbHome: "Home",
		breadcrumbProducts: "Products",
		related: "Products working with this one",
		readNext: "Continue through the product network",
		enter: `Enter ${BRAND}`,
	},
	footer: {
		statement:
			"Meet the stories you love, and let shared knowledge be inherited, created, and spread.",
		explore: "Explore",
		project: "Project",
		source: `${GITHUB} source code`,
		mainSite: "Main site",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "Page not found",
		body: `The ${URL} may have changed, or this content does not exist yet.`,
		back: "Back to home",
	},
} satisfies SiteCopy;
