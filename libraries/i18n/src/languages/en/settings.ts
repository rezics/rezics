import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	profile: "Profile",
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
