import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: postTerms } = koTerminology.post;

export default {
	memberSince: insert("{{date}} 가입", { date: String }),
	editProfile: "프로필 편집",
	tabsLabel: "프로필 페이지",
	tabs: {
		profile: "프로필",
		content: "콘텐츠",
	},
	aboutTitle: "소개",
	aboutEmpty: "이 사용자는 아직 자세한 소개를 추가하지 않았습니다.",
	contentTitle: "게시된 콘텐츠",
	contentDescription: `이 사용자의 공개 ${postTerms.pluralLabel} 및 리뷰, 그리고 그들이 소유한 컬렉션 및 카탈로그 항목.`,
	contentEmptyTitle: "아직 공개된 콘텐츠가 없습니다.",
	contentEmptyDescription: "사용자가 게시하거나 소유한 공개 콘텐츠가 여기에 나타납니다.",
} satisfies typeof import("../zh-Hant/profiles").default;
