import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const AI = verbatimTerms.ai.value;
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
const DOCK = enTerminology.dock.forms.label;

export const enContent = {
	nav: {
		home: "Home",
		how: "How it works",
		uses: "Uses",
		products: "Capability map",
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
		how: {
			title: `How it works — ${BRAND}`,
			description: `Learn how ${BRAND} connects cross-platform sources through a shared work identity, then preserves distinct contexts through language, ${REALM}s, tag votes, and personal scope.`,
		},
		uses: {
			title: `Uses — ${BRAND}`,
			description: `Explore how readers find books across platforms, ${FOLLOW_ACTION} serials, save progress, and meet fellow readers.`,
		},
		products: {
			title: `Capability map — ${BRAND}`,
			description: `See which ${BRAND} capabilities for works, content, communities, and open access are available, in development, or planned.`,
		},
	},
	home: {
		eyebrow: "inherit · create · spread",
		title: "Meet the stories you love.",
		lead: `Start with web novels scattered across platforms and languages. ${BRAND} reconnects original titles, translated titles, serial sources, chapters, and communities as one evolving work.`,
		explore: "Explore web novels",
		understand: `Understand ${BRAND}`,
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
			body: `${BRAND} builds boundaries that can extend over time through open source, content documents with version semantics, ${enTerminology.publicationLicense.forms.inline}s, and permissioned ${API}s. The capability map clearly distinguishes what is available, in development, and planned.`,
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
			focus: {
				label: "Version one starts here",
				items: [
					"Launch catalogue | first 400,000 books",
					"Cross-platform sources",
					"Cross-language work identity",
					`${REALM} reader communities`,
				],
			},
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
	how: {
		eyebrow: "How a work network takes shape",
		title:
			"The same work can cross platforms and languages, and be understood anew in different communities.",
		lead: `${BRAND} first points works, sources, and relationships to a shared identity, then returns language presentation, ${REALM} context, tag votes, and personal preferences to their own scopes. What should be shared need not be duplicated, and what should retain differences is not compressed into the site's one answer.`,
		stages: [
			{
				title: "1. Cross-platform work identity",
				body: "Original serials, translation sources, licensed platforms, and published editions keep their differences while returning to the same governable work network.",
			},
			{
				title: "2. Shared model and language presentation",
				body: "Works, booklists, order, and relationships transcend language; names, summaries, and content are presented in the reader's language.",
			},
			{
				title: `3. ${REALM} scope`,
				body: `The same Unit can enter several ${REALM}s. Each community manages its own publication relationships, rules, and curation, without acquiring ownership of the original content.`,
			},
			{
				title: "4. Tags + votes",
				body: `Global judgments, ${REALM} judgments, policy tags, and personal organization are all retained separately; classification need not pretend to be the one truth.`,
			},
			{
				title: `5. ${BLOCK_SCHEMA} and ${PORTABLE_TEXT}`,
				body: "Documents, content, occurrence, order, and publication history each have their own boundaries, so long serials and shared knowledge can continue to evolve.",
			},
			{
				title: "6. From discovery back to collaborative building",
				body: "Finding, reading, joining communities, and adding knowledge form a loop, so every act of participation lowers the next reader's cost of searching.",
			},
		],
		integrity: {
			title: "A shared identity does not mean flattening every difference.",
			body: `Works and sources need a shared foundation. ${REALM}s need their own governance and voting contexts. Personal progress and organization belong only to the individual. The core of ${BRAND} is not to centralize all data into one answer, but to keep every answer in the right scope while connecting them through the same work network.`,
		},
		v1: {
			scope: {
				title: "First distinguish what must be shared from what should remain different.",
				body: `The same work can cross platforms, languages, and communities, but different layers have different authority. These boundaries determine whether data can be reused and whether ${REALM}s and individuals retain real autonomy.`,
				layers: [
					{
						title: "Shared layer",
						body: "Across platforms and languages, it still points to the same traceable work foundation.",
						items: [
							"Stable identities for works, people, series, and tags",
							"Platform sources, editions, series, and other explicit relationships",
							"Names, summaries, and reusable content structure for every language",
						],
					},
					{
						title: `${REALM} scope`,
						body: "Communities create their own publication relationships, governance, and classification perspectives around shared objects.",
						items: [
							`Publication and ${DOCK} relationships that bring a Unit into a ${REALM}`,
							"Rules, content governance, wikis, navigation, and curation",
							`${REALM} tag contexts, votes, and ordering`,
						],
					},
					{
						title: "Personal layer",
						body: "Changes only one's own way of reading and organizing, without claiming public fact.",
						items: [
							"Interface-language and content-language preferences",
							`Reading progress, collections, and ${enTerminology.follow.forms.stateLabel}`,
							"Personal tags and judgments belonging only to oneself",
						],
					},
				],
			},
			mechanisms: {
				title: "Five interlocking core mechanisms",
				body: "Each solves a different problem. Only together do cross-language discovery, community curation, and shared governance accumulate over time.",
				exampleLabel: "Concrete scenario",
				ruleLabel: "Invariant boundary",
				capabilityLabel: "Related capabilities and current stage",
				items: [
					{
						title: "One work, no longer split apart by platforms",
						body: `A web novel may exist at once as an original serial, on translation and licensed platforms, as a published edition, and through other sources. ${BRAND} treats no platform as the boundary of the work: each ${ENTRY} retains source evidence, then connects back to a stable identity.`,
						points: [
							`A stable ${verbatimTerms.id.value} does not depend on a single ${URL}, title, or language`,
							`Canonical/variant relationships preserve edition differences without pretending that every ${ENTRY} is exactly the same`,
							"Sources say where a work appears; they do not replace proof of identity or ownership",
						],
						example: {
							title: `One serial, found through three ${ENTRY} points`,
							body: `Readers can enter through the original serial, a Chinese translation source, or a published edition. Each ${ENTRY} keeps its own information while returning to the sources, editions, and community context of the same work.`,
						},
						rule: `A platform ${URL} is a source, not a work's only identity. Citing or publishing a work does not transfer ownership.`,
					},
					{
						title: "A shared model, language-specific presentation",
						body: "Work identity, booklist members, curation order, and relationships are not tied to one language. Original titles, translated titles, summaries, and content are maintained separately by language. Interface-language and content-language preferences also decide different things.",
						points: [
							"The model preserves works, relationships, groups, and order",
							"Localization preserves names, summaries, and content appropriate to that language",
							"Interface language controls operational text; content preference controls presentation and fallback order",
						],
						example: {
							title: "A Japanese booklist still has value for Chinese readers",
							body: "The creator curates work identities and order. When Chinese readers open the same booklist, they can see the existing Chinese names and summaries. Only when localization is missing do they fall back to other languages; they do not lose the works, order, or sources.",
						},
						rule: "Adding Chinese localization completes the same shared model; it does not require duplicating a Chinese booklist.",
					},
					{
						title: `${REALM} scope: distinct community contexts on a shared foundation`,
						body: `The same work or other Unit can enter several ${REALM}s. Each ${REALM} has its own members, rules, content feed, wikis, navigation, curation, and governance context, but the shared object is not duplicated or given a new owner as a result.`,
						points: [
							`The same Unit can be published to several ${REALM}s at the same time`,
							`Each ${REALM} manages relationship state, rules, and presentation separately`,
							`Removing a relationship from a ${REALM} does not delete the original work or ${enTerminology.post.forms.label}`,
						],
						example: {
							title: "One work can be understood differently by different communities",
							body: `A translation-study ${REALM} can organize translated titles and sources; a genre-reader ${REALM} can create thematic curation and discussion rules. Both refer to the same work without having to share the same community judgment.`,
						},
						rule: `${REALM}s govern publication relationships and community context; original-content ownership does not arise because content appears there.`,
					},
					{
						title: "Tags + votes: classification is a scoped judgment",
						body: `A tag is itself a localizable identity reusable across products. Whether it applies can be expressed separately by the global community, a specific ${REALM}, a governor, or an individual. This lets classification form consensus while accommodating contextual differences.`,
						points: [
							"Global community votes: accumulate judgment across the platform",
							`${REALM}-context votes: effective only in that community's rules and ordering`,
							`${REALM} policy tags: maintained directly by governors`,
							"Personal tags: serve only one's own way of organizing",
						],
						example: {
							title: "“Isekai” can be shared vocabulary and a community judgment",
							body: `A tag's name and multilingual description can be shared. Whether a work fits the tag can separately show global and ${REALM} vote results. Individuals can use their own tags without declaring them public fact.`,
						},
						rule: `Global votes must not merge with ${REALM} votes. A governor's pinning or policy judgment is not counted as a community approval vote.`,
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}: content can keep evolving`,
						body: `${BRAND} models document content, where content appears, chapter order, and publication history separately. The ${PORTABLE_TEXT} editor directly produces structured rich text; ${BLOCK_SCHEMA} gives blocks type, stable keys, versioning, and validation boundaries.`,
						points: [
							`${BLOCK_SCHEMA} uses closed block types and does not silently admit unknown content`,
							`The ${PORTABLE_TEXT} editor produces structured content that can be verified and cited`,
							"Content Structure arranges occurrence and order; History preserves published revisions",
						],
						example: {
							title:
								"The body is one piece of content; the chapter position is another relationship",
							body: "The same chapter can be placed in the right position by Content Structure and reused where needed. Reordering a table of contents does not require duplicating the body, while publishing and restoring preserve history through explicit revisions.",
						},
						rule: "The editor creates and validates documents; content Units own the body; Content Structure arranges occurrence; publication history preserves traceable revisions.",
					},
				],
			},
			loop: {
				title: "These mechanisms ultimately return to the same loop",
				body: "The first 400,000 books create a reachable starting point. What truly keeps growing are the connections between work identity, cross-language relationships, community context, and shared judgment.",
				steps: [
					{
						title: "Cross-platform, cross-language discovery",
						body: "Find the same work from a familiar name or source.",
					},
					{
						title: `Read, collect, and ${FOLLOW_ACTION}`,
						body: "Preserve your own progress and long-term interest.",
					},
					{
						title: `Join or create a ${REALM}`,
						body: "Enter a fitting community context and its governance rules.",
					},
					{
						title: "Add sources, content, and judgments",
						body: "Contribute localization, relationships, tags, and votes.",
					},
					{
						title: "Make the next discovery more accurate",
						body: "Shared knowledge returns to search, curation, and recommendations.",
					},
				],
				closing:
					"No individual feature creates the moat on its own. Every discovery can bring new context, and every contribution makes the next discovery better.",
				capabilitiesAction: "View the full capability map",
				usesAction: "Explore practical uses",
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
				body: `Developers can currently access explicit scopes through ${API} and tokens. ${OAUTH} and ${MCP} integrations will open gradually according to the stages shown on the capability map.`,
				result: "What is usable now and where the next step leads are both made public.",
			},
		],
		closing: {
			title:
				"Want to distinguish what is available now, being built, and headed for the long term?",
			body: "The capability map marks the stage of every capability, then uses complete documentation to explain its relationship to the work network.",
			action: "Browse the capability map",
		},
	},
	products: {
		eyebrow: "Capability map",
		title: "Start with web novels; see the whole work network.",
		lead: "This records capabilities already available, systems under construction, and published design directions. Status markers describe the present; complete documentation explains how they will work together.",
		searchLabel: "Search capabilities",
		searchPlaceholder: "Search names, uses, or status",
		allLayers: "All",
		empty: "No capabilities match.",
		openProduct: "View capability",
		stage: {
			legend: "Capability status",
			current: "Current status",
			labels: { available: "Available", development: "In development", planned: "Planned" },
		},
		layers: {
			identity: {
				title: "Work identity",
				body: `Recognize the same work and connect sources, editions, series, ${enTerminology.entity.forms.plural}, and classification.`,
			},
			form: {
				title: "Reading and content",
				body: "Carry web novels, articles, media, reviews, and responses.",
			},
			structure: {
				title: "Structure and history",
				body: "Compose content and preserve block identity, published revisions, and evolutionary context.",
			},
			community: {
				title: "Community and discovery",
				body: `Collect, ${FOLLOW_ACTION}, save progress, join ${REALM}s, and keep discovery circulating.`,
			},
			open: {
				title: "Open interfaces",
				body: `Connect tools, services, ${AI}, and new ${ENTRY} points to works through explicit authority.`,
			},
		},
	},
	product: {
		breadcrumbHome: "Home",
		breadcrumbProducts: "Capability map",
		layerLabel: "Layer",
		related: "Related capabilities",
		readNext: "Keep understanding through relationships",
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
