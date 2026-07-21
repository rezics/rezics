import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;
const { forms: unitSlugTerms } = enTerminology.unitSlug;
const { forms: publicationLicenseTerms } = enTerminology.publicationLicense;

export default {
	profile: "Profile",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `Use 1–63 lowercase ${verbatimTerms.ascii.value} letters, numbers, or hyphens. After a change, the old ${verbatimTerms.url.value} permanently redirects to the new ${verbatimTerms.url.value}.`,
	preferences: "Preferences",
	interfaceLanguage: "Interface language",
	contentLanguage: "Content language preference",
	account: "Account",
	accountDescription: "Manage the current signed-in session.",
	defaultLicense: `Default ${publicationLicenseTerms.inline}`,
	general: "General",
	realmManageMode: `Create ${realmTerms.plural} in manage mode by default`,
	on: "On",
	off: "Off",
} satisfies typeof import("../zh-Hant/settings").default;
