import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: followTerms } = koTerminology.follow;
const { forms: labelTerms } = koTerminology.label;
const { forms: postTerms } = koTerminology.post;
const { forms: videoTerms } = koTerminology.video;
const { forms: audioTerms } = koTerminology.audio;
const { forms: realmTerms } = koTerminology.realm;
const { forms: entityTerms } = koTerminology.entity;
const { forms: tagStructureTerms } = koTerminology.tagStructure;
const { forms: unitSlugTerms } = koTerminology.unitSlug;
const { forms: zoneTerms } = koTerminology.zone;

export default {
	home: "홈",
	studio: verbatimTerms.studio.value,
	units: "유닛",
	entity: entityTerms.label,
	realm: realmTerms.label,
	collections: "컬렉션",
	favorites: "저장됨",
	progress: "진행률",
	me: "나",
	skipToContent: "본문으로 건너뛰기",
	navigation: "탐색",
	content: "콘텐츠",
	userMenu: {
		label: "사용자 메뉴",
		description: "프로필 보기, 환경 및 설정 조정 또는 로그아웃",
		back: "사용자 메뉴로 돌아가기",
		close: "사용자 메뉴 닫기",
		viewProfile: "프로필 보기",
		myContent: "내 콘텐츠",
		myReports: "내 신고",
		settings: "설정",
		console: "관리 콘솔",
		invitations: "받은 접근 초대",
		signOut: "로그아웃",
	},
	sidebar: {
		title: "주요 탐색",
		description: `홈, 자주 가는 곳 및 ${zoneTerms.pluralLabel}과 ${realmTerms.pluralLabel} 열기, 당신이 ${followTerms.action}`,
		open: "주요 탐색 열기",
		close: "메인 탐색 닫기",
		expand: "사이드바 확장",
		collapse: "사이드바 축소",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `모든 ${zoneTerms.pluralLabel}`,
		allRealms: `모든 ${realmTerms.pluralLabel}`,
		zonesEmpty: `${zoneTerms.pluralLabel} 당신이 ${followTerms.action} 여기에 나타납니다.`,
		realmsEmpty: `${realmTerms.pluralLabel} 당신이 ${followTerms.action} 여기에 나타납니다.`,
		loading: "사이드바 콘텐츠 로딩 중.",
		error: "사이드바 콘텐츠를 불러올 수 없습니다.",
	},
	following: {
		title: followTerms.collectionLabel,
		all: `모든 ${followTerms.gerund}`,
		empty: `당신이 ${followTerms.action} 유닛가 여기에 나타납니다.`,
		description: `당신이 ${followTerms.action} 유닛를 필터, 고정, 정리하기.`,
		filter: `${followTerms.followed} 유닛 유형 필터`,
		favorite: "고정하기",
		unfavorite: "고정 해제",
		types: {
			slug_namespace: `${unitSlugTerms.label} 네임스페이스`,
			profile: "프로필",
			book: "책",
			software: "소프트웨어",
			media: "미디어",
			video: videoTerms.label,
			audio: audioTerms.label,
			release: "릴리스",
			entity: entityTerms.label,
			label: labelTerms.label,
			tag: "태그",
			structure: tagStructureTerms.label,
			series: "시리즈",
			zone: zoneTerms.label,
			zone_page: `${zoneTerms.label} 페이지`,
			collection: "컬렉션",
			post: postTerms.label,
			poll: "설문",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label} 규칙`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
