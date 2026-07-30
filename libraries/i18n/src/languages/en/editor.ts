import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;
const { forms: zoneTerms } = enTerminology.zone;
const { forms: entityTerms } = enTerminology.entity;

export default {
	loading: "Loading editor…",
	loadFailed: "The editor could not be loaded.",
	paragraph: "Paragraph",
	heading2: "Heading 2",
	heading3: "Heading 3",
	quote: "Quote",
	bold: "Bold",
	italic: "Italic",
	bulletList: "Bulleted list",
	numberedList: "Numbered list",
	link: "Link",
	linkPrompt: `Use an ${verbatimTerms.http.value}, ${verbatimTerms.https.value}, ${verbatimTerms.mailto.value}, or relative ${verbatimTerms.url.value}.`,
	linkUrl: verbatimTerms.url.value,
	openInNewTab: "Open in a new tab",
	addLink: "Add link",
	removeLink: "Remove link",
	invalidLink: `Enter a supported ${verbatimTerms.url.value}.`,
	undo: "Undo",
	redo: "Redo",
	style: "Text style",
	preview: "Preview",
	placeholder: "Write something, or type / for blocks.",
	slashMenu: "Insert",
	slashHint: `Use / for blocks or ${verbatimTerms.profileSlugPrefix.value}, t/, e/, r/, z/ for Unit mentions.`,
	mentionSearchPrompt: "Type to search.",
	mentionUsers: "Users",
	mentionTags: "Tags",
	mentionEntities: entityTerms.pluralLabel,
	mentionRealms: realmTerms.pluralLabel,
	mentionZones: zoneTerms.pluralLabel,
	unavailableMention: "Unavailable Unit",
	richText: "Rich text",
	toolbar: "Formatting toolbar",
} satisfies typeof import("../zh-Hant/editor").default;
