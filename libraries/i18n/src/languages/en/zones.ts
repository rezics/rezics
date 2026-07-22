import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: zoneTerms } = enTerminology.zone;

export default {
	navigation: `${zoneTerms.label} navigation`,
	openNavigation: `Open ${zoneTerms.inline} navigation`,
	openMenu: insert("Open {{label}} menu", { label: String }),
	emptyTitle: `This ${zoneTerms.inline} has no home page yet`,
	emptyBody: `The ${zoneTerms.inline} managers have not published home-page content.`,
	searchTitle: `Search this ${zoneTerms.inline}`,
	searchPlaceholder: "Enter keywords",
	searchSubmit: "Search",
	searchMode: "Search mode",
	searchModes: { basic: "Basic", advanced: "Advanced" },
	searchBoolean: { yes: "Yes", no: "No" },
	searchFilters: "Search filters",
	searchControl: insert("Filter: {{name}}", { name: String }),
	searchSelect: "Select a filter",
	searchOperator: "Match rule",
	searchOperators: {
		equals: "Equals",
		notEquals: "Does not equal",
		anyOf: "Includes any",
		allOf: "Includes all",
		noneOf: "Excludes all",
		range: "Range",
		exists: "Exists",
	},
	searchRangeLower: "Range minimum",
	searchRangeUpper: "Range maximum",
	searchResults: "Search results",
	searchEmpty: "No matching content was found.",
	searchFailed: "Search is temporarily unavailable. Please try again later.",
	untitledResult: "Untitled content",
	contentList: "Content list",
} satisfies typeof import("../zh-Hant/zones").default;
