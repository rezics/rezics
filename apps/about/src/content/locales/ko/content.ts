import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;

export const koContent = {
	nav: {
		home: "홈",
		how: "작동 원리",
		uses: "활용",
		products: "기능 참고",
		enter: `${BRAND} 열기`,
		language: "언어",
		theme: "화면 모드",
		openMenu: "메뉴 열기",
		closeMenu: "메뉴 닫기",
	},
	theme: { light: "라이트", dark: "다크", toggle: "화면 모드 전환" },
	a11y: {
		skipContent: "주요 콘텐츠로 이동",
		primaryNavigation: "주요 탐색",
		utilityNavigation: "도구",
		home: `${BRAND} 홈`,
	},
	meta: {
		home: {
			title: `${BRAND} — 사랑하는 이야기를 다시 만나다`,
			description:
				"하나의 작품 정체성이 릴리스, 콘텐츠, 커뮤니티, 언어를 넘는 지식을 연결합니다.",
		},
		how: {
			title: `작동 원리 — ${BRAND}`,
			description: "작품 정체성에서 콘텐츠, 기록, 커뮤니티가 연결되는 방식을 설명합니다.",
		},
		uses: {
			title: `활용 — ${BRAND}`,
			description: "독자, 커뮤니티, 창작자, 개발자가 하나의 작품 네트워크를 활용하는 방법.",
		},
		products: {
			title: `기능 참고 — ${BRAND}`,
			description: "작품, 콘텐츠, 커뮤니티, 공개 접근의 전체 기능을 살펴봅니다.",
		},
	},
	home: {
		eyebrow: "이어받기 · 만들기 · 퍼뜨리기",
		title: "사랑하는 이야기를 다시 만나다.",
		lead: `${BRAND}는 처음부터 다국어를 지원하도록 설계된 콘텐츠 구성·게시 및 커뮤니티 협업 플랫폼입니다. 작품, ${koTerminology.metadata.forms.inline}, ${koTerminology.post.forms.plural}, 컬렉션, 분류, 커뮤니티 공간은 각각 안정적인 정체성을 가지며 하나의 시스템 안에서 연결하고, 만들고, 관리하고, 탐색하고, 토론하고, 운영할 수 있습니다.`,
		explore: "활용 살펴보기",
		understand: "원리 이해하기",
		problem: {
			title: "사랑하는 작품은 같지만 발견하는 것은 조각입니다.",
			body: "언어, 판본, 미디어 형태, 커뮤니티마다 항목이 갈립니다. 독자는 같은 작품을 반복해 식별하고, 창작 귀속과 축적된 지식은 플랫폼 경계에서 사라집니다.",
		},
		promise: {
			title: "먼저 작품을 식별하고, 그 주변에서 지식이 자라게 합니다.",
			body: `${BRAND}는 안정적인 작품 정체성에서 시작합니다. 이름이 번역되고 콘텐츠가 변하고 커뮤니티가 다른 관점을 구성해도 같은 대상을 이해하고 추적할 수 있습니다.`,
		},
		principles: [
			{
				title: "이어받기",
				body: "작품이 이미 가진 역사, 언어, 릴리스, 커뮤니티 기억.",
			},
			{
				title: "만들기",
				body: "콘텐츠를 쓰고 구조를 만들고 귀속을 기록하며 새로운 이해를 만듭니다.",
			},
			{
				title: "퍼뜨리기",
				body: "커뮤니티, 공개 프로토콜, 언어 간 연결을 통해 지식이 계속 흐르게 합니다.",
			},
		],
		model: {
			title: "하나의 정체성이 층을 거쳐 완전한 맥락이 됩니다.",
			body: "섞어서는 안 되는 의미를 분리하고 명확한 관계로 연결합니다.",
			steps: [
				{
					title: "작품 정체성",
					body: "작품은 언어나 표현 방식이 바뀌어도 유지되는 안정적인 핵심을 가집니다.",
				},
				{
					title: "릴리스와 관계",
					body: `시리즈, 릴리스, ${koTerminology.entity.forms.label}, 태그, 귀속이 작품을 실제 맥락에 놓습니다.`,
				},
				{
					title: "콘텐츠와 기록",
					body: "콘텐츠 구조, 편집, 기록이 순서, 변화, 재사용을 보존합니다.",
				},
				{
					title: "개인과 커뮤니티",
					body: `컬렉션, ${koTerminology.realm.forms.label}, ${koTerminology.zone.forms.label}, 피드가 모델을 일상 경험으로 만듭니다.`,
				},
			],
		},
		outcomes: {
			title: "독자를 위해, 그리고 작품 자체를 위해.",
			body: "같은 기반이 탐색 비용을 줄이고 창작 귀속을 보존하며 작품이 자신에게 맞는 독자를 만나게 합니다.",
			cards: [
				{ title: "찾기", body: "언어를 넘어 작품, 릴리스, 창작자를 식별합니다." },
				{
					title: "이해하기",
					body: "구조, 리뷰, 위키, 기록, 관계를 따라 전체 맥락을 봅니다.",
				},
				{
					title: "이어가기",
					body: "진행도를 보존하고 커뮤니티에 참여하며 개인 경험을 공동 기억으로 만듭니다.",
				},
			],
		},
		open: {
			title: "개방성은 기억이 이어지는 조건입니다.",
			body: `${BRAND}는 오픈 소스, 이동 가능한 콘텐츠, ${koTerminology.publicationLicense.forms.label}, 권한 기반 ${API}로 외부 도구와 연결됩니다.`,
		},
		closing: {
			title: "소중한 작품 하나에서 시작하세요.",
			body: "작품, 커뮤니티, 만들어지는 공동 지식을 탐색할 수 있습니다.",
			action: `${BRAND} 열기`,
		},
		contact: {
			title: "함께 실현하고 싶은 아이디어가 있나요?",
			body: "제품 협업, 오픈 소스 참여, 콘텐츠 모델에 관한 논의, 더 나은 방향을 위한 제안 등 어떤 이야기든 들려주세요.",
			action: "문의하기",
		},
	},
	how: {
		eyebrow: "기반부터",
		title: "더 큰 목록이 아니라 작품이 연결된 채로 남는 방법.",
		lead: `${BRAND}는 정체성, 표현, 관계, 콘텐츠, 신뢰, 탐색을 차례로 세웁니다. 각 층이 하나의 의미를 지키므로 언어, 미디어, 커뮤니티를 넘을 수 있습니다.`,
		stages: [
			{
				title: "1. 작품 정체성",
				body: `안정적인 ${verbatimTerms.id.value}가 작품을 식별하며 현지화 이름과 유형 ${koTerminology.metadata.forms.label}는 다른 작품을 만들지 않고 변할 수 있습니다.`,
			},
			{
				title: "2. 표현과 유형",
				body: "도서, 미디어, 소프트웨어가 고유한 필드와 경험을 유지하면서 정체성과 관계를 공유합니다.",
			},
			{
				title: "3. 관계와 귀속",
				body: `시리즈, 릴리스, ${koTerminology.entity.forms.label}, 태그, 창작 귀속, 주제 관계가 이해 가능한 네트워크를 만듭니다.`,
			},
			{
				title: "4. 콘텐츠 블록과 콘텐츠 구조",
				body: "콘텐츠 블록은 표현 가능한 콘텐츠를 담고 콘텐츠 구조는 배치, 순서, 재사용, 분기를 관리합니다.",
			},
			{
				title: "5. 기록, 라이선스, 거버넌스",
				body: "게시 경계가 추적 가능한 버전을 만들고 라이선스, 접근 규칙, 거버넌스가 권한과 신뢰를 설명합니다.",
			},
			{
				title: "6. 탐색 화면",
				body: `검색, 피드, ${koTerminology.realm.forms.label}, ${koTerminology.zone.forms.label}이 찾기, 읽기, 참여, 돌아오기의 경로를 만듭니다.`,
			},
		],
		integrity: {
			title: "의미를 분리하고 가치로 연결합니다.",
			body: "정체성은 제목이 아니고, 릴리스는 시리즈가 아니며, 콘텐츠 블록은 구조 노드가 아닙니다. 분명한 경계가 연결을 설명 가능하게 합니다.",
		},
	},
	uses: {
		eyebrow: "필요에서 시작",
		title: "하나의 작품 네트워크, 여러 실제 여정.",
		lead: `독자는 데이터 모델부터 배울 필요가 없습니다. 책을 찾고, 시리즈를 ${koTerminology.follow.forms.actionLabel}하고, 커뮤니티에 참여하고, 진행도를 저장하면서 시작합니다.`,
		resultLabel: "얻게 되는 것",
		journeys: [
			{
				title: "언어를 넘어 같은 작품 찾기",
				body: "번역명, 원제, 창작자, 릴리스, 미디어 형태에서 시작해 관계를 단계적으로 확인합니다.",
				result: "반복 검색 대신 신뢰할 수 있는 하나의 입구를 얻습니다.",
			},
			{
				title: "판본과 창작 맥락 이해하기",
				body: `시리즈, 릴리스, ${koTerminology.entity.forms.label}, 캐릭터, 창작자, 출판사를 차이를 유지한 채 연결해 봅니다.`,
				result: "무엇을 보고 있으며 어디에서 왔는지 알 수 있습니다.",
			},
			{
				title: "읽고 기여하기",
				body: `도서 구조, ${koTerminology.post.forms.label}, 위키, 이미지, 리뷰, 평점을 읽고 자신의 이해를 보탭니다.`,
				result: "콘텐츠가 설명하는 작품과 계속 연결됩니다.",
			},
			{
				title: "관심 커뮤니티에 참여하기",
				body: `${koTerminology.realm.forms.label}에서 공동 규칙을 만들고 ${koTerminology.zone.forms.label}에서 관점을 큐레이션하며 피드로 토론을 이어갑니다.`,
				result: "커뮤니티 지식이 사라지는 메시지 흐름에 머물지 않습니다.",
			},
			{
				title: "모으고 돌아와 이어가기",
				body: "컬렉션과 라이브러리로 작품을 정리하고 진행도를 저장해 같은 맥락으로 돌아옵니다.",
				result: "개인 여정과 공동 지식이 서로를 돕습니다.",
			},
			{
				title: "귀속과 조건을 보존해 게시하기",
				body: `콘텐츠를 구성하고 기여 관계를 기록하며 ${koTerminology.publicationLicense.forms.label}를 선택하고 기록을 보존합니다.`,
				result: "기원을 잃지 않고 이해하고 참조하고 재사용할 수 있습니다.",
			},
			{
				title: "도구와 새로운 입구 만들기",
				body: `${API}, ${OAUTH}, 범위가 있는 토큰으로 검색, 편집, 커뮤니티 작업을 같은 정체성에 연결합니다.`,
				result: "새 데이터 고립을 만들지 않고 네트워크를 확장합니다.",
			},
		],
		closing: {
			title: "모든 기능의 연결을 보고 싶나요?",
			body: "작품 정체성에서 공개 인터페이스까지 가치, 흐름, 관계, 경계를 확인할 수 있습니다.",
			action: "전체 기능 보기",
		},
	},
	products: {
		eyebrow: "전체 참고",
		title: "작품 정체성에서 개방형 생태계까지.",
		lead: "26개 기능을 전체 모델에서의 위치에 따라 정리했습니다. 관련 없는 기능 모음이 아니라 작품을 식별하고 공동 지식을 이어 가는 경로입니다.",
		searchLabel: "기능 검색",
		searchPlaceholder: "이름 또는 용도",
		allLayers: "전체",
		empty: "조건에 맞는 기능이 없습니다.",
		openProduct: "기능 보기",
		layers: {
			identity: {
				title: "정체성과 관계",
				body: `작품을 식별하고 릴리스, 시리즈, ${koTerminology.entity.forms.label}, 분류를 연결합니다.`,
			},
			form: { title: "콘텐츠 형태", body: "읽기, 보기, 창작, 리뷰, 응답을 담습니다." },
			structure: {
				title: "구조와 기억",
				body: "콘텐츠를 구성하고 게시, 차이, 변화를 보존합니다.",
			},
			community: {
				title: "개인과 커뮤니티",
				body: `모으고, 큐레이션하고, 토론하고, ${koTerminology.follow.forms.actionLabel}하고, 돌아옵니다.`,
			},
			open: {
				title: "개방형 생태계",
				body: "명확한 권한으로 도구, 서비스, 새 입구를 연결합니다.",
			},
		},
	},
	product: {
		breadcrumbHome: "홈",
		breadcrumbProducts: "기능 참고",
		layerLabel: "계층",
		related: "관련 기능",
		readNext: "계속 알아보기",
		enter: `${BRAND} 열기`,
	},
	footer: {
		statement: "사랑하는 이야기를 만나고 공동 지식을 이어받고 만들고 퍼뜨립니다.",
		explore: "탐색",
		project: "프로젝트",
		source: `${GITHUB} 소스`,
		mainSite: "메인 사이트",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "페이지를 찾을 수 없습니다",
		body: "주소가 바뀌었거나 콘텐츠가 존재하지 않습니다.",
		back: "홈으로",
	},
} satisfies SiteCopy;
