import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = enTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Kind",
	verification: "Verification",
	owner: "Owner",
	verified: "Verified",
	unverified: "Unverified",
	measurements: "Measurements",
	height: "Height",
	weight: "Weight",
	bust: "Bust",
	waist: "Waist",
	hips: "Hips",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `New ${entityTerms.inline}`,
	newTag: "New tag",
	externalLinksDescription: `Public pages that support information about this ${entityTerms.inline}.`,
	externalLinksEmpty: "No external links yet.",
	relatedContentTitle: "Related content",
	relatedContentDescription: `Content related to this ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "No related content",
	relatedContentEmptyDescription: "There is no related content to display yet.",
} satisfies typeof import("../zh-Hant/entities").default;
