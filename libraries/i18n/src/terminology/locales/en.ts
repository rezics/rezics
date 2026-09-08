import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const enTerminology = defineTerminology("en", {
	music: {
		status: "approved",
		forms: { label: "Music", inline: "music", plural: "music" },
		forbidden: [],
	},
	musicRecording: {
		status: "approved",
		forms: { label: "Music recording", inline: "music recording", plural: "music recording" },
		forbidden: [],
	},
	musicTrack: {
		status: "approved",
		forms: { label: "Music track", inline: "music track", plural: "music tracks" },
		forbidden: [],
	},
	musicMedium: {
		status: "approved",
		forms: { label: "Release medium", inline: "release medium", plural: "release media" },
		forbidden: [],
	},
	musicRelease: {
		status: "approved",
		forms: { label: "Music release", inline: "music release", plural: "music release" },
		forbidden: [],
	},
	musicReleaseGroup: {
		status: "approved",
		forms: { label: "Release group", inline: "release group", plural: "release group" },
		forbidden: [],
	},
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
	customTheme: {
		status: "approved",
		forms: {
			label: "Custom Theme",
			pluralLabel: "Custom Themes",
			inline: "custom theme",
			plural: "custom themes",
		},
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
	video: {
		status: "approved",
		forms: { label: "Video", pluralLabel: "Videos", inline: "video", plural: "videos" },
		forbidden: [],
	},
	audio: {
		status: "approved",
		forms: { label: "Audio", pluralLabel: "Audio", inline: "audio", plural: "audio" },
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
	tagPath: {
		status: "approved",
		forms: {
			label: "Tag path",
			pluralLabel: "Tag paths",
			inline: "tag path",
			plural: "tag paths",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	license: {
		status: "approved",
		forms: { label: "License", inline: "license" },
		forbidden: [],
	},
	entity: {
		status: "approved",
		forms: { label: "Entity", pluralLabel: "Entities", inline: "entity", plural: "entities" },
		forbidden: ["Catalog", "catalog"],
	},
	metadata: {
		status: "approved",
		forms: { label: "Metadata", inline: "metadata" },
		forbidden: ["Basic information"],
	},
});
