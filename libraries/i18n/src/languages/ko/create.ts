import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: postTerms } = koTerminology.post;
const { forms: realmTerms } = koTerminology.realm;
const { forms: entityTerms } = koTerminology.entity;
const { forms: zoneTerms } = koTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "생성, 유지 관리 또는 관리하도록 지정된 콘텐츠 보기.",
		backToApplication: `${verbatimTerms.rezics.value}로 돌아가기`,
		navigation: `${verbatimTerms.studio.value} 탐색`,
		overview: "콘텐츠 유형",
		backToOverview: "콘텐츠 유형으로 돌아가기",
	},
	sections: {
		book: { label: "도서", description: "작업과 관련된 도서를 보고 관리하세요." },
		software: {
			label: "소프트웨어",
			description: "귀하의 작업과 관련된 소프트웨어 항목 보기 및 관리",
		},
		media: { label: "미디어", description: "귀하의 작업과 관련된 미디어 보기 및 관리" },
		entity: {
			label: entityTerms.pluralLabel,
			description: `작업과 관련된 ${entityTerms.plural} 보기 및 관리`,
		},
		tag: { label: "태그", description: "귀하의 작업과 관련된 태그 보기 및 관리" },
		realm: {
			label: realmTerms.label,
			description: `귀하의 작업과 관련된 ${realmTerms.label} 보기 및 관리`,
		},
		zone: {
			label: zoneTerms.label,
			description: `귀하의 작업과 관련된 ${zoneTerms.label} 보기 및 관리`,
		},
		post: {
			label: postTerms.label,
			description: `귀하의 작업과 관련된 ${postTerms.label} 보기 및 관리`,
		},
		wiki: {
			label: "위키 문서",
			description: "귀하가 관리하는 위키 문서 보기 및 관리",
		},
		collection: {
			label: "컬렉션",
			description: "귀하의 작업과 관련된 컬렉션 보기 및 관리",
		},
		review: { label: "리뷰", description: "귀하의 작업과 관련된 리뷰 보기 및 관리" },
		poll: { label: "설문조사", description: "귀하의 작업과 관련된 설문조사 보기 및 관리" },
	},
	realmTagContext: {
		label: `${realmTerms.label} 태그 설명`,
		description: `이 ${realmTerms.label}에서 태그를 설명하는 위키 문서를 만듭니다.`,
	},
	communityUnitSearch: {
		policyTitle: "만들기 전에 검색하세요",
		policy: "건강한 커뮤니티 환경을 유지하기 위해 공개 항목을 만들기 전에 검색하여 만들려는 콘텐츠가 아직 존재하지 않는지 확인하세요. 공개 항목 만들기 기능을 악용하면 제재를 받을 수 있습니다.",
		confirmationLabel: insert(
			"기존 {{subject}}을(를) 살펴보고 이 항목이 아직 존재하지 않음을 확인했습니다.",
			{ subject: String },
		),
		prompt: insert("기존 {{subject}} 검색", { subject: String }),
		pageTitle: insert("기존 {{subject}} 검색", { subject: String }),
		pageDescription: insert("만들려는 {{subject}}이(가) 이미 존재하는지 확인하세요.", {
			subject: String,
		}),
		backToSection: insert("{{subject}}으로 돌아가기", { subject: String }),
		searchLabel: insert("{{subject}} 검색", { subject: String }),
		searchPlaceholder: insert("{{subject}} 이름 입력", { subject: String }),
		searchAction: "검색",
		searchHint: "이름을 입력해 기존에 있을 수 있는 항목을 검색하세요.",
		searchFailed: "현재 검색을 사용할 수 없습니다. 다시 시도하거나 만들기 양식으로 돌아가세요.",
		resultsTitle: "이미 존재할 수 있는 항목",
		noResultsTitle: insert("일치하는 {{subject}}을(를) 찾지 못했습니다", { subject: String }),
		noResultsDescription: "검색어가 올바른지 확인한 후 만들기를 계속할 수 있습니다.",
		realmTagContextOnly: `여기에는 이 ${realmTerms.label}에서 공식적으로 설명한 태그만 표시됩니다. 태그가 없다면 먼저 ${realmTerms.label} 관리자가 태그 설명을 만들어야 합니다.`,
		notListedTitle: "검색 결과 중 원하는 항목이 없나요?",
		notListedDescription:
			"유사한 항목을 먼저 확인하고, 해당하는 항목이 없을 때만 새 항목을 만드세요.",
		createAction: "계속 만들기",
		subjects: {
			book: "도서",
			software: "소프트웨어 항목",
			media: "미디어 항목",
			person: "인물",
			organization: "조직",
			character: "캐릭터",
			tag: "태그",
		},
	},
	list: {
		create: "생성",
		empty: "현재 필터와 일치하는 콘텐츠가 없습니다",
		untitled: "제목 없는 콘텐츠",
		contributionCount: insert("기여 {{count}}회", { count: Number }),
		activity: {
			visited: "방문",
			updated: "업데이트",
			created: "생성",
			relevant: "관련",
		},
	},
	filters: {
		viewLabel: "작업 관계",
		permissionLabel: "현재 권한",
		workStateLabel: "작업 상태",
		statusLabel: "콘텐츠 상태",
		visibilityLabel: "가시성",
		sortLabel: "정렬 순서",
		any: "모든",
		more: "필터 더 보기",
		clear: "필터 지우기",
		cancel: "취소",
		apply: "필터 적용",
		views: {
			all: "내 작업",
			created: "내가 생성",
			contributed: "내가 기여",
			assigned: "직접 할당",
			delegated: "팀 위임",
		},
		permissions: {
			"unit.update": "편집 가능",
			"unit.status.update": "상태를 변경할 수 있음",
			"unit.access.manage": "접근을 관리할 수 있음",
			"unit.realm-publication.manage": `${realmTerms.label} 게시를 관리할 수 있음`,
		},
		workStates: { actionable: "실행 가능", blocked: "현재 차단됨" },
		statuses: { draft: "초안", published: "게시됨", archived: "보관됨" },
		visibilities: { public: "공개", unlisted: "비공개(목록에 없음)", private: "비공개" },
		sorts: {
			recent: "최근 방문됨",
			updated: "최근 업데이트됨",
			created: "최근 생성됨",
			relevant: "최근 관련됨",
		},
	},
	relations: {
		created: "생성자",
		contributed: "기여자",
		assigned: "직접 할당됨",
		delegated: "팀 위임",
		blocked: "현재 차단됨",
	},
	developmentBadge: "개발 중",
} satisfies typeof import("../zh-Hant/create").default;
