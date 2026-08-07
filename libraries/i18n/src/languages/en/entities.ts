import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: entityTerms } = enTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Kind",
	verification: "Verification",
	owner: "Owner",
	verified: "Verified",
	unverified: "Unverified",
	newEntity: `New ${entityTerms.inline}`,
	newTag: "New tag",
	sourceLinksDescription: `Public pages that support information about this ${entityTerms.inline}.`,
	sourceLinksEmpty: "No source links yet.",
	relatedContentTitle: "Related content",
	relatedContentDescription: `Content related to this ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "No related content",
	relatedContentEmptyDescription: "There is no related content to display yet.",
} satisfies typeof import("../zh-Hant/entities").default;
