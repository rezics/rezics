import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: followTerms } = koTerminology.follow;
const { forms: postTerms } = koTerminology.post;
const { forms: realmTerms } = koTerminology.realm;
const { forms: entityTerms } = koTerminology.entity;
const { forms: tagPathTerms } = koTerminology.tagPath;
const { forms: zoneTerms } = koTerminology.zone;
const { forms: videoTerms } = koTerminology.video;
const { forms: audioTerms } = koTerminology.audio;

export default {
	title: "피드",
	subtitle: "작품은 토론을 통해 표시됩니다.",
	personalized: "당신을 위해",
	sortLabel: "피드 정렬",
	sort: { best: "최고", new: "새로움" },
	filtersLabel: "피드 필터",
	filters: {
		title: "필터",
		clear: "필터 지우기",
		cancel: "취소",
		apply: "필터 적용",
		selectedCount: insert("{{count}} 선택됨", { count: Number }),
		languages: {
			label: "언어",
			all: "모든 언어",
			options: { zh: "중국어", en: "영어" },
		},
		realms: {
			label: realmTerms.label,
			all: `모든 ${realmTerms.pluralLabel}`,
			unnamed: `이름 없는 ${realmTerms.label}`,
		},
		tags: {
			label: "태그",
			all: "모든 태그",
			unnamed: "이름 없는 태그",
		},
	},
	contentFilterLabel: "콘텐츠 필터",
	pagination: {
		label: "추가 콘텐츠 불러오기 방식",
		modes: {
			"load-more": "‘더 불러오기’ 버튼 표시",
			infinite: "스크롤할 때 자동으로 불러오기",
		},
	},
	content: {
		clear: "전체 삭제",
		allSelected: "모든 콘텐츠",
		selectedCount: insert("{{count}} 선택됨", { count: Number }),
		unitGroup: "유닛",
		postGroup: postTerms.pluralLabel,
		kinds: {
			"unit:profile": "프로필",
			"unit:book": "도서",
			"unit:software": "소프트웨어",
			"unit:media": "미디어",
			"unit:video": videoTerms.label,
			"unit:audio": audioTerms.label,
			"unit:release": "발매",
			"unit:entity": entityTerms.pluralLabel,
			"unit:tag": "태그",
			"unit:structure": tagPathTerms.pluralLabel,
			"unit:series": "시리즈",
			"unit:zone": zoneTerms.pluralLabel,
			"unit:collection": "컬렉션",
			"unit:poll": "설문조사",
			"unit:realm": realmTerms.pluralLabel,
			"post:post": postTerms.pluralLabel,
			"post:reply": "답글",
			"post:excerpt": "발췌",
			"post:review": "리뷰",
			"post:chapter": "장",
			"post:wiki": "위키 문서",
			"post:picture": `그림 ${postTerms.plural}`,
		},
		postDescription: "커뮤니티 회원이 시작한 주제",
		replyDescription: "진행 중인 토론의 답글",
	},
	discoverWorks: "시간을 투자할 가치가 있는 작품 발견",
	emptyTitle: "여기는 조용합니다",
	emptyBody: "작품이나 아이디어를 가장 먼저 공유하세요.",
	reason: {
		followedUnit: `당신이 이 항목이나 신용받은 기여자를 ${followTerms.action}했기 때문에`,
		followedRealm: `당신이 ${realmTerms.inline}을 ${followTerms.action}했기 때문에`,
		basedOnActivity: "최근 활동을 기반으로",
		relatedSubject: "당신이 보고 있는 것과 관련하여",
		popularNow: "지금 인기 있음",
		newAndRelevant: "새롭고 잠재적으로 관련 있음",
	},
	recommendationMenu: "추천 옵션",
	moreActions: "추가 작업",
	notInterested: "관심 없음",
	actions: {
		voteGroup: "콘텐츠 등급",
		comments: insert("{{count}} 답글", { count: Number }),
		shareTitle: "콘텐츠 공유",
		shareDescription: "기기의 공유 메뉴를 사용하거나 콘텐츠 링크를 복사하세요.",
		shareNative: "다른 앱으로 공유",
		copyLink: "링크 복사",
		linkCopied: "링크가 복사되었습니다",
		shareFailed: "공유할 수 없습니다. 나중에 다시 시도하세요.",
		saved: "저장됨",
		addToCollection: "컬렉션에 추가",
		collectionPickerTitle: "컬렉션에 추가",
		collectionPickerDescription: "이 콘텐츠를 위한 컬렉션을 선택하세요.",
		collectionAdded: "컬렉션에 추가됨",
		noOwnedCollections: "사용 가능한 컬렉션이 아직 없습니다.",
		manageCollections: "컬렉션 관리",
	},
	replyingIn: "에 답글 작성 중",
	relatedPosts: "관련 토론",
	relatedWorks: "유사 작품",
	activeRealms: `활성 ${realmTerms.pluralLabel}`,
	continueReading: "계속 읽기",
	viewAll: "모두 보기",
	relatedWork: "관련 작품",
	realmTagContext: `${realmTerms.label} 태그 설명`,
	excerptSource: "발췌 출처",
	excerptSourceMark: "―",
	myRealms: `내 ${realmTerms.pluralLabel}`,
	contextSeparator: "에",
	attributionList: insert("{{count}} 기여자 명단", { count: Number }),
	realmList: insert(`{{count}} ${realmTerms.pluralLabel}`, { count: Number }),
	showAttributionList: insert("{{attribution}} 및 {{count}} 외 더 보기; 크레딧 표시", {
		attribution: String,
		count: Number,
	}),
	showRealmList: insert(`{{realm}} 및 {{count}} 외 더 보기; ${realmTerms.inline} 목록 표시`, {
		realm: String,
		count: Number,
	}),
	targetScore: insert("{{score}}/10 · {{count}} 평가", {
		score: String,
		count: Number,
	}),
	noRatings: "아직 평가 없음",
	collectionDirectItems: insert("{{count}} 직접 항목", { count: Number }),
} satisfies typeof import("../zh-Hant/feed").default;
