import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	profile: "Profile",
	slugAddress: `Public ${verbatimTerms.url.value} identifier`,
	slugAddressHint: `Use 1–63 lowercase ${verbatimTerms.ascii.value} letters, numbers, or hyphens. After a change, the old ${verbatimTerms.url.value} permanently redirects to the new ${verbatimTerms.url.value}.`,
	preferences: "Preferences",
	interfaceLanguage: "Interface language",
	contentLanguage: "Content language preference",
	account: "Account",
	accountDescription: "Manage the current signed-in session.",
	defaultLicense: `Default ${verbatimTerms.license.value}`,
	general: "General",
	realmManageMode: "Create realms in manage mode by default",
	on: "On",
	off: "Off",
} satisfies typeof import("../zh-Hant/settings").default;
