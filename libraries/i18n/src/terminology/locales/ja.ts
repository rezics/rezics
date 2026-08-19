import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const jaTerminology = defineTerminology("ja", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "フォロー",
			action: "フォロー",
			stateLabel: "フォロー中",
			gerund: "フォロー",
			followed: "フォロー済み",
			undoActionLabel: "フォロー解除",
			undoAction: "フォロー解除",
			follower: "フォロワー",
			collectionLabel: "フォロー中",
		},
		forbidden: ["購読", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: { label: "ゾーン", pluralLabel: "ゾーン", inline: "ゾーン", plural: "ゾーン" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "領域", pluralLabel: "領域", inline: "領域", plural: "領域" },
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: { label: "配置枠", pluralLabel: "配置枠", inline: "配置枠", plural: "配置枠" },
		forbidden: ["Dock", "Docks"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "パス識別子",
			pluralLabel: "パス識別子",
			inline: "パス識別子",
			plural: "パス識別子",
		},
		forbidden: ["Slug", "slug"],
	},
	post: {
		status: "approved",
		forms: { label: "投稿", pluralLabel: "投稿", inline: "投稿", plural: "投稿" },
		forbidden: ["Post", "Posts"],
	},
	video: {
		status: "approved",
		forms: { label: "動画", pluralLabel: "動画", inline: "動画", plural: "動画" },
		forbidden: ["Video", "Videos"],
	},
	audio: {
		status: "approved",
		forms: { label: "音声", pluralLabel: "音声", inline: "音声", plural: "音声" },
		forbidden: ["Audio", "Audios"],
	},
	label: {
		status: "approved",
		forms: {
			label: "分類ラベル",
			pluralLabel: "分類ラベル",
			inline: "分類ラベル",
			plural: "分類ラベル",
		},
		forbidden: [],
	},
	tagStructure: {
		status: "approved",
		forms: {
			label: "タグパス",
			pluralLabel: "タグパス",
			inline: "タグパス",
			plural: "タグパス",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	license: {
		status: "approved",
		forms: { label: "ライセンス", inline: "ライセンス" },
		forbidden: ["Publication license"],
	},
	entity: {
		status: "approved",
		forms: {
			label: "エンティティ",
			pluralLabel: "エンティティ",
			inline: "エンティティ",
			plural: "エンティティ",
		},
		forbidden: ["Catalog"],
	},
	metadata: {
		status: "approved",
		forms: { label: "メタデータ", inline: "メタデータ" },
		forbidden: ["Basic information"],
	},
});
