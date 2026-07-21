import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	sectionsLabel: "Book sections",
	book: "Book",
	main: "main",
	identity: "Book identity",
	variants: "main and variants",
	contents: "Chapter structure",
	history: "History",
	published: "Published",
	title: "Book title",
	variantDescription: "main · variant: translation-edition · Unit / Book",
	contentStructure: String(verbatimTerms.contentStructure.value),
	gameContentStructure: String(verbatimTerms.gameContentStructure.value),
	chapterOne: "01 · Chapter title",
	chapterTwo: "02 · Chapter title",
	reusedInterlude: "03 · Reused interlude",
	postA: `${enTerminology.post.forms.label} A`,
	postB: `${enTerminology.post.forms.label} B`,
	credits: "Attribution",
	creditAttribution: String(verbatimTerms.creditAttribution.value),
	author: "Author",
	translator: "Translator",
	publisher: "Publisher",
	entity: "Entity record",
};

export default content;
