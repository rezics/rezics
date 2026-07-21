import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
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
} satisfies typeof import("../zh-Hant/editor").default;
