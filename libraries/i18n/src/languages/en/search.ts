import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;

export default {
	title: "Search",
	placeholder: `Search units, entities, tags, ${postTerms.plural}, ${realmTerms.plural}, or users`,
	advancedFilters: "Advanced filters",
	scope: "Search scope",
	language: "Content language",
	allLanguages: "All languages",
	resetFilters: "Reset filters",
	empty: "No matching results.",
} satisfies typeof import("../zh-Hant/search").default;
