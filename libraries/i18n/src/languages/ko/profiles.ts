import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: realmTerms } = koTerminology.realm;
const { forms: zoneTerms } = koTerminology.zone;
const { forms: entityTerms } = koTerminology.entity;

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
	activityScoreRealm: insert(`${realmTerms.label}: {{realm}}`, { realm: String }),
	activityScoreValue: insert("{{value}} / 10", { value: Number }),
	activityProgressValue: insert("{{percentage}}%", { percentage: Number }),
	progressStatuses: {
		backlog: "시작 전",
		active: "진행 중",
		paused: "일시 중지",
		completed: "완료",
		dropped: "중단",
	},
	contentTitle: "공개 콘텐츠",
	contentDescription: `이 사용자에게 직접 크레딧되거나 사용자를 게시자로 크레딧한 ${entityTerms.inline}를 통해 연결된 공개 콘텐츠와 사용자가 소유한 ${realmTerms.pluralLabel} 및 ${zoneTerms.pluralLabel}을 표시합니다.`,
	contentEmptyTitle: "아직 공개된 콘텐츠가 없습니다.",
	contentEmptyDescription: `크레딧된 공개 콘텐츠와 소유한 ${realmTerms.pluralLabel} 또는 ${zoneTerms.pluralLabel}이 여기에 표시됩니다.`,
} satisfies typeof import("../zh-Hant/profiles").default;
