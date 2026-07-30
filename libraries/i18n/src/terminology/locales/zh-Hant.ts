import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const zhHantTerminology = defineTerminology("zh-Hant", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "追蹤",
			action: "追蹤",
			stateLabel: "追蹤中",
			gerund: "追蹤",
			followed: "追蹤",
			undoActionLabel: "取消追蹤",
			undoAction: "取消追蹤",
			follower: "追蹤者",
			collectionLabel: "追蹤項目",
		},
		forbidden: ["訂閱", "關注", "跟隨", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: { label: "專區", pluralLabel: "專區", inline: "專區", plural: "專區" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "領域", pluralLabel: "領域", inline: "領域", plural: "領域" },
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: { label: "停靠區", pluralLabel: "停靠區", inline: "停靠區", plural: "停靠區" },
		forbidden: ["Dock", "Docks", "碼頭"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "路徑標識",
			pluralLabel: "路徑標識",
			inline: "路徑標識",
			plural: "路徑標識",
		},
		forbidden: ["Slug", "slug", "公開網址標識", "網址標識", "路徑識別碼"],
	},
	post: {
		status: "approved",
		forms: { label: "貼文", pluralLabel: "貼文", inline: "貼文", plural: "貼文" },
		forbidden: ["Post", "Posts", "帖子"],
	},
	video: {
		status: "approved",
		forms: { label: "影片", pluralLabel: "影片", inline: "影片", plural: "影片" },
		forbidden: ["Video", "Videos", "視頻"],
	},
	audio: {
		status: "approved",
		forms: { label: "音訊", pluralLabel: "音訊", inline: "音訊", plural: "音訊" },
		forbidden: ["Audio", "Audios", "音頻"],
	},
	label: {
		status: "approved",
		forms: {
			label: "分類標目",
			pluralLabel: "分類標目",
			inline: "分類標目",
			plural: "分類標目",
		},
		forbidden: [],
	},
	tagStructure: {
		status: "approved",
		forms: {
			label: "標籤路徑",
			pluralLabel: "標籤路徑",
			inline: "標籤路徑",
			plural: "標籤路徑",
		},
		forbidden: ["Tag structure", "Structure tag", "結構標籤"],
	},
	publicationLicense: {
		status: "approved",
		forms: { label: "作品授權條款", inline: "授權條款" },
		forbidden: ["License", "作品 License", "授權 REZICS"],
	},
	metadata: {
		status: "approved",
		forms: { label: "中繼資料", inline: "中繼資料" },
		forbidden: ["Metadata", "基本資訊"],
	},
});
