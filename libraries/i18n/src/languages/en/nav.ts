import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: followTerms } = enTerminology.follow;
const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;
const { forms: unitSlugTerms } = enTerminology.unitSlug;
const { forms: zoneTerms } = enTerminology.zone;

export default {
	home: "Home",
	studio: verbatimTerms.studio.value,
	units: "Units",
	entity: "Entity",
	realm: realmTerms.label,
	collections: "Collections",
	favorites: "Saved",
	progress: "Progress",
	me: "Me",
	skipToContent: "Skip to main content",
	navigation: "Navigation",
	content: "Content",
	userMenu: {
		label: "User menu",
		description: "View your profile, adjust preferences and settings, or sign out.",
		back: "Back to user menu",
		close: "Close user menu",
		viewProfile: "View profile",
		myContent: "My content",
		settings: "Settings",
		profileSettings: "Edit profile",
		preferenceSettings: "Preferences",
		invitations: "Received access invitations",
		accountSettings: "Account",
		signOut: "Sign out",
	},
	sidebar: {
		title: "Main navigation",
		description: `Open Home, frequent destinations, and the ${zoneTerms.pluralLabel} and ${realmTerms.pluralLabel} you ${followTerms.action}.`,
		open: "Open main navigation",
		close: "Close main navigation",
		expand: "Expand sidebar",
		collapse: "Collapse sidebar",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `All ${zoneTerms.pluralLabel}`,
		allRealms: `All ${realmTerms.pluralLabel}`,
		zonesEmpty: `${zoneTerms.pluralLabel} you ${followTerms.action} will appear here.`,
		realmsEmpty: `${realmTerms.pluralLabel} you ${followTerms.action} will appear here.`,
		loading: "Loading sidebar content.",
		error: "Sidebar content could not be loaded.",
	},
	following: {
		title: followTerms.collectionLabel,
		all: `All ${followTerms.gerund}`,
		empty: `Units you ${followTerms.action} will appear here.`,
		description: `Filter, pin, and organize the Units you ${followTerms.action}.`,
		filter: `Filter ${followTerms.followed} Unit types`,
		favorite: "Pin",
		unfavorite: "Unpin",
		types: {
			slug_namespace: `${unitSlugTerms.label} namespace`,
			profile: "Profile",
			book: "Book",
			software: "Software",
			media: "Media",
			release: "Release",
			entity: "Entity",
			tag: "Tag",
			series: "Series",
			zone: zoneTerms.label,
			collection: "Collection",
			post: postTerms.label,
			poll: "Poll",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label} rule`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
