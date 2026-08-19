import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const koTerminology = defineTerminology("ko", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "팔로우",
			action: "팔로우",
			stateLabel: "팔로우 중",
			gerund: "팔로우",
			followed: "팔로우함",
			undoActionLabel: "팔로우 취소",
			undoAction: "팔로우 취소",
			follower: "팔로워",
			collectionLabel: "팔로우 중",
		},
		forbidden: ["구독", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: { label: "구역", pluralLabel: "구역", inline: "구역", plural: "구역" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "영역", pluralLabel: "영역", inline: "영역", plural: "영역" },
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: {
			label: "배치 영역",
			pluralLabel: "배치 영역",
			inline: "배치 영역",
			plural: "배치 영역",
		},
		forbidden: ["Dock", "Docks"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "경로 식별자",
			pluralLabel: "경로 식별자",
			inline: "경로 식별자",
			plural: "경로 식별자",
		},
		forbidden: ["Slug", "slug"],
	},
	post: {
		status: "approved",
		forms: { label: "게시물", pluralLabel: "게시물", inline: "게시물", plural: "게시물" },
		forbidden: ["Post", "Posts"],
	},
	video: {
		status: "approved",
		forms: { label: "동영상", pluralLabel: "동영상", inline: "동영상", plural: "동영상" },
		forbidden: ["Video", "Videos"],
	},
	audio: {
		status: "approved",
		forms: { label: "오디오", pluralLabel: "오디오", inline: "오디오", plural: "오디오" },
		forbidden: ["Audio", "Audios"],
	},
	label: {
		status: "approved",
		forms: {
			label: "분류 항목",
			pluralLabel: "분류 항목",
			inline: "분류 항목",
			plural: "분류 항목",
		},
		forbidden: [],
	},
	tagStructure: {
		status: "approved",
		forms: {
			label: "태그 경로",
			pluralLabel: "태그 경로",
			inline: "태그 경로",
			plural: "태그 경로",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	license: {
		status: "approved",
		forms: { label: "라이선스", inline: "라이선스" },
		forbidden: ["Publication license"],
	},
	entity: {
		status: "approved",
		forms: { label: "엔터티", pluralLabel: "엔터티", inline: "엔터티", plural: "엔터티" },
		forbidden: ["Catalog"],
	},
	metadata: {
		status: "approved",
		forms: { label: "메타데이터", inline: "메타데이터" },
		forbidden: ["Basic information"],
	},
});
