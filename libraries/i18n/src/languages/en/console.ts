import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = enTerminology.realm;

export default {
	title: "Management console",
	description:
		"Platform capabilities unlock each management area; this does not represent a user identity or employment relationship.",
	backToApplication: "Back to application",
	navigation: "Management console navigation",
	overview: "All management areas",
	cancel: "Cancel",
	sections: {
		access: {
			label: "Platform access",
			description:
				"Inspect or manage platform capabilities granted to Profiles, including each grant's expiry and provenance.",
		},
		audit: {
			label: "Security audit",
			description: `Review high-impact administrative events and security decisions across the platform, ${realmTerms.pluralLabel}, and Units.`,
		},
	},
	access: {
		searchTitle: "Find a Profile",
		searchLabel: "Name or sign-in email",
		searchPlaceholder: "Enter a name or email",
		search: "Search",
		searchResults: "Search results",
		activeProfiles: "Profiles with active platform access",
		noProfiles: "There are no active platform capability grants.",
		noSearchResults: "No matching Profiles were found.",
		selectProfile: "Select a Profile to inspect its platform access.",
		capabilityCount: insert("{{count}} capabilities", { count: Number }),
		capability: "Capability",
		expiry: "Expiry",
		expiryFor: insert("Expiry for {{capability}}", { capability: String }),
		noExpiry: "No expiry",
		provenance: "Grant provenance",
		grantProvenance: insert("Granted by {{profileId}} on {{date}}", {
			profileId: String,
			date: String,
		}),
		notGranted: "Not directly granted",
		readOnly: "You can inspect platform access but cannot change it.",
		grantAll: "Grant all capabilities",
		clearAll: "Clear all capabilities",
		save: "Save platform access",
		revokeAllTitle: "Revoke all platform access from this Profile?",
		revokeAllDescription:
			"This revokes every active grant. The server rejects the change if it would remove the final non-expiring platform access manager.",
		confirmRevokeAll: "Confirm full revocation",
	},
	audit: {
		category: "Event category",
		allCategories: "All categories",
		categories: {
			admin_activity: "Administrative activity",
			policy_denied: "Policy denial",
			system_event: "System event",
		},
		outcome: "Outcome",
		allOutcomes: "All outcomes",
		outcomes: {
			succeeded: "Succeeded",
			denied: "Denied",
			failed: "Failed",
		},
		time: "Time",
		action: "Action",
		actor: "Actor",
		authority: "Authority",
		authorities: {
			platform: "Platform",
			realm: realmTerms.label,
			unit: "Unit",
		},
		empty: "No audit events match the current filters.",
		previousPage: "Previous page",
		nextPage: "Next page",
		selectEvent: "Select an event to inspect its full audit record.",
		detailsTitle: "Event details",
		systemActor: "System",
		credential: "Credential kind",
		credentialId: `Credential ${verbatimTerms.id.value}`,
		credentials: {
			session: "Interactive session",
			api_token: `${verbatimTerms.api.value} token`,
			bootstrap: "System bootstrap",
			system: "System process",
		},
		scopedAuthority: insert("{{kind}} ({{id}})", { kind: String, id: String }),
		target: "Target",
		noTarget: "No specific target",
		reasonCode: "Reason code",
		requestId: `Request ${verbatimTerms.id.value}`,
		traceId: `Trace ${verbatimTerms.id.value}`,
		rawDetails: "Structured details",
	},
} satisfies typeof import("../zh-Hant/console").default;
