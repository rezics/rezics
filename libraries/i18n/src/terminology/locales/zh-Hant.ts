import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const zhHantTerminology = defineTerminology("zh-Hant", {
	publisher: {
		status: "approved",
		forms: { label: "出版者", pluralLabel: "出版者", inline: "出版者", plural: "出版者" },
		forbidden: [],
	},
	publishingWork: {
		status: "approved",
		forms: { label: "文字作品", pluralLabel: "文字作品", inline: "文字作品", plural: "文字作品" },
		forbidden: [],
	},
	textVersion: {
		status: "approved",
		forms: { label: "文本版本", pluralLabel: "文本版本", inline: "文本版本", plural: "文本版本" },
		forbidden: [],
	},
	publication: {
		status: "approved",
		forms: { label: "出版品", pluralLabel: "出版品", inline: "出版品", plural: "出版品" },
		forbidden: [],
	},
	serialization: {
		status: "approved",
		forms: { label: "連載", pluralLabel: "連載", inline: "連載", plural: "連載" },
		forbidden: [],
	},
	publishingCoverage: {
		status: "approved",
		forms: {
			label: "內容涵蓋範圍",
			pluralLabel: "內容涵蓋範圍",
			inline: "內容涵蓋範圍",
			plural: "內容涵蓋範圍",
		},
		forbidden: [],
	},
	publishingInstallment: {
		status: "approved",
		forms: { label: "連載篇章", pluralLabel: "連載篇章", inline: "連載篇章", plural: "連載篇章" },
		forbidden: [],
	},
	chapter: {
		status: "approved",
		forms: { label: "章節", pluralLabel: "章節", inline: "章節", plural: "章節" },
		forbidden: [],
	},
	program: {
		status: "approved",
		forms: { label: "影視作品", pluralLabel: "影視作品", inline: "影視作品", plural: "影視作品" },
		forbidden: [],
	},
	softwareContent: {
		status: "approved",
		forms: { label: "軟體作品", pluralLabel: "軟體作品", inline: "軟體作品", plural: "軟體作品" },
		forbidden: [],
	},
	softwareVersion: {
		status: "approved",
		forms: { label: "軟體版本", pluralLabel: "軟體版本", inline: "軟體版本", plural: "軟體版本" },
		forbidden: [],
	},
	softwareRelease: {
		status: "approved",
		forms: {
			label: "軟體發行版本",
			pluralLabel: "軟體發行版本",
			inline: "軟體發行版本",
			plural: "軟體發行版本",
		},
		forbidden: [],
	},
	grouping: {
		status: "approved",
		forms: { label: "目錄分組", pluralLabel: "目錄分組", inline: "目錄分組", plural: "目錄分組" },
		forbidden: [],
	},
	referenceConcept: {
		status: "approved",
		forms: { label: "參照概念", pluralLabel: "參照概念", inline: "參照概念", plural: "參照概念" },
		forbidden: [],
	},
	distributionPackage: {
		status: "approved",
		forms: { label: "散布套件", pluralLabel: "散布套件", inline: "散布套件", plural: "散布套件" },
		forbidden: [],
	},
	publishingCatalog: {
		status: "approved",
		forms: { label: "出版目錄", pluralLabel: "出版目錄", inline: "出版目錄", plural: "出版目錄" },
		forbidden: [],
	},
	software: {
		status: "approved",
		forms: { label: "軟體", pluralLabel: "軟體", inline: "軟體", plural: "軟體" },
		forbidden: [],
	},
	referenceCatalog: {
		status: "approved",
		forms: { label: "參照條目", pluralLabel: "參照條目", inline: "參照條目", plural: "參照條目" },
		forbidden: [],
	},
	music: {
		status: "approved",
		forms: { label: "音樂", inline: "音樂", plural: "音樂" },
		forbidden: [],
	},
	musicRecording: {
		status: "approved",
		forms: { label: "錄音", inline: "錄音", plural: "錄音" },
		forbidden: [],
	},
	musicTrack: {
		status: "approved",
		forms: { label: "曲目", inline: "曲目", plural: "曲目" },
		forbidden: [],
	},
	musicMedium: {
		status: "approved",
		forms: { label: "載體", inline: "載體", plural: "載體" },
		forbidden: [],
	},
	musicRelease: {
		status: "approved",
		forms: { label: "發行版本", inline: "發行版本", plural: "發行版本" },
		forbidden: [],
	},
	musicReleaseGroup: {
		status: "approved",
		forms: { label: "發行組", inline: "發行組", plural: "發行組" },
		forbidden: [],
	},
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
	customTheme: {
		status: "approved",
		forms: {
			label: "自訂主題",
			pluralLabel: "自訂主題",
			inline: "自訂主題",
			plural: "自訂主題",
		},
		forbidden: [],
	},
	tagPath: {
		status: "approved",
		forms: {
			label: "標籤路徑",
			pluralLabel: "標籤路徑",
			inline: "標籤路徑",
			plural: "標籤路徑",
		},
		forbidden: ["Tag structure", "Structure tag", "結構標籤"],
	},
	license: {
		status: "approved",
		forms: { label: "授權", inline: "授權" },
		forbidden: ["公開授權", "作品 License", "授權 REZICS"],
	},
	entity: {
		status: "approved",
		forms: {
			personLabel: "現實人物",
			organizationLabel: "組織機構",
			characterLabel: "虛構角色",
			label: "實體",
			pluralLabel: "實體",
			inline: "實體",
			plural: "實體",
		},
		forbidden: ["Catalog", "Entity"],
	},
	metadata: {
		status: "approved",
		forms: { label: "中繼資料", inline: "中繼資料" },
		forbidden: ["Metadata", "基本資訊"],
	},
});
