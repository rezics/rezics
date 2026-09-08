import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const zhHansTerminology = defineTerminology("zh-Hans", {
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
		forms: { label: "出版物", pluralLabel: "出版物", inline: "出版物", plural: "出版物" },
		forbidden: [],
	},
	serialization: {
		status: "approved",
		forms: { label: "连载", pluralLabel: "连载", inline: "连载", plural: "连载" },
		forbidden: [],
	},
	publishingCoverage: {
		status: "approved",
		forms: {
			label: "内容涵盖范围",
			pluralLabel: "内容涵盖范围",
			inline: "内容涵盖范围",
			plural: "内容涵盖范围",
		},
		forbidden: [],
	},
	publishingInstallment: {
		status: "approved",
		forms: { label: "连载篇章", pluralLabel: "连载篇章", inline: "连载篇章", plural: "连载篇章" },
		forbidden: [],
	},
	chapter: {
		status: "approved",
		forms: { label: "章节", pluralLabel: "章节", inline: "章节", plural: "章节" },
		forbidden: [],
	},
	program: {
		status: "approved",
		forms: { label: "影视作品", pluralLabel: "影视作品", inline: "影视作品", plural: "影视作品" },
		forbidden: [],
	},
	softwareContent: {
		status: "approved",
		forms: { label: "软件作品", pluralLabel: "软件作品", inline: "软件作品", plural: "软件作品" },
		forbidden: [],
	},
	softwareVersion: {
		status: "approved",
		forms: { label: "软件版本", pluralLabel: "软件版本", inline: "软件版本", plural: "软件版本" },
		forbidden: [],
	},
	softwareRelease: {
		status: "approved",
		forms: {
			label: "软件发行版本",
			pluralLabel: "软件发行版本",
			inline: "软件发行版本",
			plural: "软件发行版本",
		},
		forbidden: [],
	},
	grouping: {
		status: "approved",
		forms: { label: "目录分组", pluralLabel: "目录分组", inline: "目录分组", plural: "目录分组" },
		forbidden: [],
	},
	referenceConcept: {
		status: "approved",
		forms: { label: "参照概念", pluralLabel: "参照概念", inline: "参照概念", plural: "参照概念" },
		forbidden: [],
	},
	distributionPackage: {
		status: "approved",
		forms: { label: "分发包", pluralLabel: "分发包", inline: "分发包", plural: "分发包" },
		forbidden: [],
	},
	publishingCatalog: {
		status: "approved",
		forms: { label: "出版目录", pluralLabel: "出版目录", inline: "出版目录", plural: "出版目录" },
		forbidden: [],
	},
	software: {
		status: "approved",
		forms: { label: "软件", pluralLabel: "软件", inline: "软件", plural: "软件" },
		forbidden: [],
	},
	referenceCatalog: {
		status: "approved",
		forms: { label: "参照条目", pluralLabel: "参照条目", inline: "参照条目", plural: "参照条目" },
		forbidden: [],
	},
	music: {
		status: "approved",
		forms: { label: "音乐", inline: "音乐", plural: "音乐" },
		forbidden: [],
	},
	musicRecording: {
		status: "approved",
		forms: { label: "录音", inline: "录音", plural: "录音" },
		forbidden: [],
	},
	musicTrack: {
		status: "approved",
		forms: { label: "曲目", inline: "曲目", plural: "曲目" },
		forbidden: [],
	},
	musicMedium: {
		status: "approved",
		forms: { label: "载体", inline: "载体", plural: "载体" },
		forbidden: [],
	},
	musicRelease: {
		status: "approved",
		forms: { label: "发行版本", inline: "发行版本", plural: "发行版本" },
		forbidden: [],
	},
	musicReleaseGroup: {
		status: "approved",
		forms: { label: "发行组", inline: "发行组", plural: "发行组" },
		forbidden: [],
	},
	follow: {
		status: "approved",
		forms: {
			actionLabel: "关注",
			action: "关注",
			stateLabel: "已关注",
			gerund: "关注",
			followed: "已关注",
			undoActionLabel: "取消关注",
			undoAction: "取消关注",
			follower: "关注者",
			collectionLabel: "关注项目",
		},
		forbidden: ["订阅", "跟随", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: { label: "专区", pluralLabel: "专区", inline: "专区", plural: "专区" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "领域", pluralLabel: "领域", inline: "领域", plural: "领域" },
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: { label: "停靠区", pluralLabel: "停靠区", inline: "停靠区", plural: "停靠区" },
		forbidden: ["Dock", "Docks", "码头"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "路径标识",
			pluralLabel: "路径标识",
			inline: "路径标识",
			plural: "路径标识",
		},
		forbidden: ["Slug", "slug", "路径识别码"],
	},
	post: {
		status: "approved",
		forms: { label: "帖子", pluralLabel: "帖子", inline: "帖子", plural: "帖子" },
		forbidden: ["Post", "Posts"],
	},
	video: {
		status: "approved",
		forms: { label: "视频", pluralLabel: "视频", inline: "视频", plural: "视频" },
		forbidden: ["Video", "Videos", "影片"],
	},
	audio: {
		status: "approved",
		forms: { label: "音频", pluralLabel: "音频", inline: "音频", plural: "音频" },
		forbidden: ["Audio", "Audios", "音訊"],
	},
	label: {
		status: "approved",
		forms: {
			label: "分类标目",
			pluralLabel: "分类标目",
			inline: "分类标目",
			plural: "分类标目",
		},
		forbidden: [],
	},
	customTheme: {
		status: "approved",
		forms: {
			label: "自定义主题",
			pluralLabel: "自定义主题",
			inline: "自定义主题",
			plural: "自定义主题",
		},
		forbidden: [],
	},
	tagPath: {
		status: "approved",
		forms: {
			label: "标签路径",
			pluralLabel: "标签路径",
			inline: "标签路径",
			plural: "标签路径",
		},
		forbidden: ["Tag structure", "Structure tag", "结构标签"],
	},
	license: {
		status: "approved",
		forms: { label: "许可", inline: "许可" },
		forbidden: ["公开许可", "作品 License", "授权 REZICS"],
	},
	entity: {
		status: "approved",
		forms: {
			personLabel: "现实人物",
			organizationLabel: "组织机构",
			characterLabel: "虚构角色",
			label: "实体",
			pluralLabel: "实体",
			inline: "实体",
			plural: "实体",
		},
		forbidden: ["Catalog", "Entity"],
	},
	metadata: {
		status: "approved",
		forms: { label: "元数据", inline: "元数据" },
		forbidden: ["Metadata", "基本信息"],
	},
});
