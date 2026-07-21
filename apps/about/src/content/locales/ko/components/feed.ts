import { koTerminology } from "@rezics/i18n/terminology/ko";

const content = {
	consumers: "이 기능을 사용하는 제품",
	zone: koTerminology.zone.forms.label,
	realm: koTerminology.realm.forms.label,
	home: "Home",
	zoneFeed: `${koTerminology.zone.forms.label} 피드`,
	realmFeed: `${koTerminology.realm.forms.label} 피드`,
	homeFeed: "홈 피드",
	postCard: `${koTerminology.post.forms.label} 카드`,
	bookCard: "Book 카드",
	commentCard: "Comment 카드",
	kindAware: "종류 인식",
	catalog: "카탈로그",
	discussion: "토론",
	consumerConfiguration: "소비자 설정",
	query: "쿼리",
	consumerScope: "소비자 범위",
	card: "카드",
	perFeature: "기능별",
	order: "순서",
	feedOrder: "Feed 순서",
} satisfies typeof import("../../en/components/feed").default;

export default content;
