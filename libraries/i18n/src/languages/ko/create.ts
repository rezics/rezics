import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: postTerms } = koTerminology.post;
const { forms: realmTerms } = koTerminology.realm;
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
			label: "카탈로그 항목",
			description: "귀하의 작업과 관련된 카탈로그 항목 보기 및 관리",
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
