import { insert } from "native-i18n";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: metadataTerms } = koTerminology.metadata;

export default {
	title: "컬렉션",
	favorites: "즐겨찾기",
	newCollection: "새 컬렉션",
	createDescription: "콘텐츠를 조직하고, 발표하며, 공유하기 위한 컬렉션을 만듭니다.",
	editCollection: "컬렉션 관리",
	deleteCollection: "컬렉션 삭제",
	deleteCollectionPrompt: "컬렉션 및 그 배열은 삭제 후 복구할 수 없습니다.",
	emptyCollections: "아직 컬렉션이 없습니다.",
	containingUnitEmpty: "이 작품을 포함한 공개 컬렉션이 아직 없습니다.",
	emptyCollectionTitle: "이 컬렉션은 비어 있습니다.",
	emptyCollectionBody: "추가된 콘텐츠는 피드와 동일한 카드 형식으로 여기 표시됩니다.",
	contentLabel: "컬렉션 콘텐츠",
	itemCount: insert("{{count}} 항목", { count: Number }),
	directCollectionHint:
		"컬렉션은 하나의 항목으로 추가되며, 그 내용이 재귀적으로 가져오지 않습니다.",
	save: {
		action: "저장",
		title: "컬렉션에 저장",
		directDescription: "즐겨찾기 또는 사용자 지정 컬렉션을 선택하세요.",
		reviewDescription: "사용자 지정 컬렉션에서는 리뷰가 리뷰 대상 작품 아래에 배치됩니다.",
		favoritesDescription: "상하 관계를 만들지 않고 빠르게 저장하세요.",
		searchLabel: "컬렉션 찾기",
		searchPlaceholder: "컬렉션 이름 입력",
		noMatches: "일치하는 컬렉션이 없습니다.",
		noCollections: "콘텐츠를 수용할 수 있는 컬렉션이 아직 없습니다.",
		createLabel: "컬렉션 생성",
		createPlaceholder: "컬렉션 이름",
		createAndSave: "생성 및 저장",
		manage: "컬렉션 관리",
		saved: "저장됨",
		notSaved: "저장되지 않음",
	},
	workspace: {
		title: "컬렉션 관리",
		description: `콘텐츠, ${metadataTerms.inline}, 구조, 프레젠테이션, 접근 및 히스토리를 관리하세요.`,
		navigation: "컬렉션 관리 네비게이션",
		overview: "컬렉션 관리 화면",
		backToCollection: "컬렉션으로 돌아가기",
		backToContent: "콘텐츠로 돌아가기",
		sections: {
			content: {
				label: "콘텐츠",
				description: "각 콘텐츠 언어에서 제목, 요약 및 표지를 편집하세요.",
			},
			metadata: {
				label: metadataTerms.label,
				description: `상태 및 가시성 ${metadataTerms.inline} 설정 또는 컬렉션 삭제`,
			},
			items: {
				label: "콘텐츠 및 구조",
				description: "콘텐츠를 추가, 제거, 정렬, 중첩 및 추천합니다.",
			},
			presentation: {
				label: "프레젠테이션",
				description: "콘텐츠 레이아웃 및 정렬 규칙 선택",
			},
			access: {
				label: "접근",
				description: "권한 주체, 권한 및 제한 관리",
			},
			history: {
				label: "기록",
				description: "컬렉션 개정 리뷰, 비교 및 복원",
			},
		},
	},
	items: {
		add: "콘텐츠 추가",
		target: "콘텐츠",
		role: "역할",
		parent: "상위 항목",
		topLevel: "최상위",
		item: "표준 항목",
		featured: "추천 항목",
		remove: "제거",
		moveEarlier: "앞쪽으로 이동",
		moveLater: "뒤쪽으로 이동",
		saveStructure: "구조 업데이트",
		empty: "이 컬렉션에는 아직 관리 가능한 콘텐츠가 없습니다.",
	},
	presentation: {
		layout: "레이아웃",
		order: "순서",
		save: "프레젠테이션 저장",
		layouts: {
			flat: "단일 열 피드",
			nested: "부모-자식 그룹",
			shelf: "카드 선반",
		},
		orders: {
			manual: "수동 순서",
			name: "이름",
			"added-at": "추가 날짜",
		},
	},
	form: {
		language: "콘텐츠 언어",
		title: "제목",
		summary: "요약",
		cover: "표지",
		status: "상태",
		visibility: "가시성",
		save: "변경 사항 저장",
	},
	cancel: "취소",
	delete: "삭제",
	close: "닫기",
} satisfies typeof import("../zh-Hant/collections").default;
