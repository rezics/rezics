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
} satisfies typeof import("../zh-Hant/entities").default;
