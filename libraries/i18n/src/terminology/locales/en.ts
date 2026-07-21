import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const enTerminology = defineTerminology("en", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "Follow",
			action: "follow",
			stateLabel: "Following",
			gerund: "following",
			followed: "followed",
			undoActionLabel: "Unfollow",
			undoAction: "unfollow",
			follower: "follower",
			collectionLabel: "Following",
		},
		forbidden: ["Subscribe", "Subscribed", "Subscription", "Unsubscribe"],
	},
	zone: {
		status: "approved",
		forms: { label: "Zone", pluralLabel: "Zones", inline: "zone", plural: "zones" },
		forbidden: [],
	},
	realm: {
		status: "approved",
		forms: { label: "Realm", pluralLabel: "Realms", inline: "realm", plural: "realms" },
		forbidden: [],
	},
	dock: {
		status: "approved",
		forms: { label: "Dock", pluralLabel: "Docks", inline: "dock", plural: "docks" },
		forbidden: [],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "Path identifier",
			pluralLabel: "Path identifiers",
			inline: "path identifier",
			plural: "path identifiers",
		},
		forbidden: ["Slug", "slug"],
	},
	post: {
		status: "approved",
		forms: { label: "Post", pluralLabel: "Posts", inline: "post", plural: "posts" },
		forbidden: [],
	},
	label: {
		status: "approved",
		forms: {
			label: "Taxonomy label",
			pluralLabel: "Taxonomy labels",
			inline: "taxonomy label",
			plural: "taxonomy labels",
		},
		forbidden: [],
	},
	publicationLicense: {
		status: "approved",
		forms: { label: "Publication license", inline: "publication license" },
		forbidden: [],
	},
});
