import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const zhHansTerminology = defineTerminology("zh-Hans", {
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
	tagStructure: {
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
		forms: { label: "实体", pluralLabel: "实体", inline: "实体", plural: "实体" },
		forbidden: ["Catalog", "Entity"],
	},
	metadata: {
		status: "approved",
		forms: { label: "元数据", inline: "元数据" },
		forbidden: ["Metadata", "基本信息"],
	},
});
