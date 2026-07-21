import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	zone: enTerminology.zone.forms.label,
	blocks: "Block configuration",
	query: "Content query",
	history: "History",
	preview: "Product preview",
	path: `${enTerminology.zone.forms.label} / configuration`,
	blockSchema: String(verbatimTerms.blockSchema.value),
	headerBlock: "Header block",
	feedBlock: "Feed block · query: recent",
	collectionBlock: "Collection block · reference",
	feedResult: "Feed result",
	postCard: `${enTerminology.post.forms.label} card`,
	catalogResult: "Catalog result",
	bookCard: "Book card",
	discussion: "Discussion",
	comment: "Comment",
};

export default content;
