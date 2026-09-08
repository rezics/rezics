import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = enTerminology.entity;

export default {
	fixedProfile: {
		title: "Basic details",
		typeRevisionId: "Type definition revision",
		genderRevisionId: "Gender definition revision",
		areaId: "Area entry",
		beginAreaId: "Place of origin entry",
		endAreaId: "Place of ending entry",
		begin: "Beginning",
		end: "Ending",
		ended: "Has ended",
		referenceNotice:
			"Enter the exact definition revision identifiers for type and gender, and existing area entry identifiers for locations. Leave unknown values blank.",
		remove: "Remove basic details",
		removed: "Basic details removed",
		resolve: "Confirm specific type",
		resolveNotice:
			"The specific type can be confirmed only while it is unresolved. Save any other changes first.",
	},
	contextMeasurements: {
		title: "Measurements in context",
		context: "Related content",
		chooseContext: "Choose related content",
		noVisibleMeasurement: "No current measurements are visible for this context.",
		edit: "Edit contextual measurements",
		millimetres: "millimetres",
		grams: "grams",
		scopeNotice:
			"These values apply only to the selected content. Saving replaces its complete measurement set.",
		unknownNotice: "Leave unknown values blank. Zero is recorded as zero.",
		invalid:
			"Enter non-negative whole numbers within the supported range, or leave unknown values blank.",
		save: "Save contextual measurements",
	},
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
