const content = {
	nav: {
		products: "제품",
		platform: "플랫폼",
		history: "History",
		docs: "문서",
		github: "GitHub",
		language: "언어",
		theme: "테마",
		openMenu: "메뉴 열기",
		closeMenu: "메뉴 닫기",
	},
	theme: {
		light: "라이트",
		dark: "다크",
		toggle: "색상 테마 전환",
	},
	status: {
		implemented: "구현됨",
		documented: "설계 확인됨",
		planned: "계획 중",
		research: "연구 중",
	},
	classes: {
		surface: "제품 표면",
		capability: "공유 기능",
		manifestation: "제품 형태",
		protocol: "내부 프로토콜",
	},
	labels: {
		conceptPreview: "콘셉트 미리보기",
		conceptCaption:
			"나중에 같은 크기의 실제 화면으로 교체할 수 있는 코드 기반 제품 전시입니다.",
		viewProduct: "제품 보기",
		viewAll: "전체 보기",
		learnMore: "자세히 보기",
		documentation: "Outline 문서",
		sourceCode: "소스 코드",
		relatedProducts: "관련 제품",
		usedCapabilities: "사용하는 공유 기능",
		noParent: "상위 운반 제품이 없는 독립 제품",
		parentProduct: "상위 제품",
		sourceBasis: "사실 출처",
	},
	footer: {
		statement: "Rezics는 콘텐츠의 정체성, 구조, 이력을 중심으로 한 오픈 제품 체계입니다.",
		productLinks: "제품",
		platformLinks: "플랫폼",
		openLinks: "오픈",
	},
	notFound: {
		title: "페이지를 찾을 수 없습니다",
		body: "링크가 이동했거나 아직 공개되지 않았습니다.",
		back: "홈으로 돌아가기",
	},
	a11y: {
		skipContent: "주요 콘텐츠로 건너뛰기",
		primaryNavigation: "주요 내비게이션",
		mobileNavigation: "모바일 내비게이션",
		breadcrumb: "이동 경로",
		modes: "기능 모드",
	},
} satisfies typeof import("../en/common").default;

export default content;
