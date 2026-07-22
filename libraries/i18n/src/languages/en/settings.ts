import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: realmTerms } = enTerminology.realm;
const { forms: unitSlugTerms } = enTerminology.unitSlug;
const { forms: publicationLicenseTerms } = enTerminology.publicationLicense;

export default {
	workspace: {
		title: "Settings",
		description: "Manage your profile, preferences, account security, and invitations.",
		backToApplication: "Back to the application",
		backToOverview: "Back to settings",
		navigation: "Settings navigation",
		overview: "All settings",
		sections: {
			profile: {
				label: "Profile",
				description: "Update your public name, bio, avatar, banner, and profile address.",
			},
			preferences: {
				label: "Preferences",
				description:
					"Choose interface and content languages, ratings, and a default license.",
			},
			account: {
				label: "Account",
				description: "Review account information and manage your current sign-in.",
			},
			security: {
				label: "Security",
				description: "Change your password and manage signed-in devices.",
			},
			invitations: {
				label: "Invitations",
				description: "Review and respond to Unit access invitations you received.",
			},
		},
	},
	profile: "Profile",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `Use 1–63 lowercase ${verbatimTerms.ascii.value} letters, numbers, or hyphens. After a change, the old ${verbatimTerms.url.value} permanently redirects to the new ${verbatimTerms.url.value}.`,
	preferences: "Preferences",
	interfaceLanguage: "Interface language",
	contentLanguage: "Content language preference",
	account: "Account",
	accountDescription: "Manage the current signed-in session.",
	security: "Security",
	securityDescription: "Change your account password. You can also sign out other devices.",
	currentPassword: "Current password",
	newPassword: "New password",
	revokeOtherSessions: "Sign out other devices after changing password",
	passwordChanged: "Your password has been changed.",
	sessions: "Signed-in devices",
	sessionsDescription: "Revoke sessions you no longer use or recognize.",
	currentSession: "Current device",
	unknownDevice: "Unknown device",
	unknownAddress: "Unknown address",
	lastUpdated: "Recent activity",
	sessionExpires: "Expires",
	revokeSession: "Sign out this device",
	defaultLicense: `Default ${publicationLicenseTerms.inline}`,
	general: "General",
	realmManageMode: `Create ${realmTerms.plural} in manage mode by default`,
	on: "On",
	off: "Off",
} satisfies typeof import("../zh-Hant/settings").default;
