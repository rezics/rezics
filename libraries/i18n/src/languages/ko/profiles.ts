import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: postTerms } = koTerminology.post;

export default {
	memberSince: insert("{{date}} 가입", { date: String }),
	editProfile: "프로필 편집",
	tabsLabel: "프로필 페이지",
	tabs: {
		profile: "프로필",
		activity: "활동",
		content: "콘텐츠",
	},
	aboutTitle: "소개",
	aboutEmpty: "이 사용자는 아직 자세한 소개를 추가하지 않았습니다.",
	activityTitle: "평점 및 진행 상황",
	activityDescription:
		"개별 항목과 전체 개인정보 설정에 따라 볼 수 있는 평점과 현재 진행 상황을 표시합니다.",
	activityEmpty: "표시할 수 있는 평점이나 진행 상황이 아직 없습니다.",
	activityScores: "평점",
	activityProgress: "진행 상황",
	activityScoreContext: insert("맥락: {{context}}", { context: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "시작 전",
		active: "진행 중",
		paused: "일시 중지",
		completed: "완료",
		dropped: "중단",
	},
	contentTitle: "게시된 콘텐츠",
	contentDescription: `이 사용자의 공개 ${postTerms.pluralLabel} 및 리뷰, 그리고 그들이 소유한 컬렉션 및 카탈로그 항목.`,
	contentEmptyTitle: "아직 공개된 콘텐츠가 없습니다.",
	contentEmptyDescription: "사용자가 게시하거나 소유한 공개 콘텐츠가 여기에 나타납니다.",
} satisfies typeof import("../zh-Hant/profiles").default;
