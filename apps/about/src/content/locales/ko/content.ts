import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { SiteCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const API = verbatimTerms.api.value;
const OAUTH = verbatimTerms.oauth.value;
const MCP = verbatimTerms.mcp.value;
const BLOCK_SCHEMA = verbatimTerms.blockSchema.value;
const PORTABLE_TEXT = verbatimTerms.portableText.value;
const JSON = verbatimTerms.json.value;
const URL = verbatimTerms.url.value;
const GITHUB = verbatimTerms.github.value;
const REZICS_INC = verbatimTerms.rezicsInc.value;
const AGPL30 = verbatimTerms.agpl30.value;
const FOLLOW = koTerminology.follow.forms.actionLabel;
const REALM = koTerminology.realm.forms.label;

export const koContent = {
	nav: {
		home: "홈",
		uses: "활용",
		products: "제품",
		enter: `${BRAND} 시작하기`,
		language: "언어",
		theme: "표시 모드",
		openMenu: "메뉴 열기",
		closeMenu: "메뉴 닫기",
	},
	theme: { light: "라이트", dark: "다크", toggle: "표시 모드 전환" },
	a11y: {
		skipContent: "본문으로 건너뛰기",
		primaryNavigation: "주 탐색",
		utilityNavigation: "도구 탐색",
		home: `${BRAND} 홈`,
	},
	meta: {
		home: {
			title: `${BRAND} — 사랑하는 이야기를 만나다`,
			description: `플랫폼과 언어를 넘어 웹소설을 찾고, 연재를 ${koTerminology.follow.forms.action}하며, ${REALM}에서 동료를 만나세요.`,
		},
		uses: {
			title: `활용 — ${BRAND}`,
			description: `독자가 플랫폼을 넘어 책을 찾고, 연재를 ${koTerminology.follow.forms.action}하며, 진행도를 보존하고 동료를 찾는 방법을 살펴봅니다.`,
		},
		products: {
			title: `제품 — ${BRAND}`,
			description: `처음부터 다국어인 단위를 공동 기반으로 삼고, 언어를 넘는 책 목록, 태그와 커뮤니티 분류, 위키, ${REALM}으로 작품을 언어·플랫폼·커뮤니티 너머까지 이어 갑니다.`,
		},
	},
	home: {
		eyebrow: "전승 · 창작 · 전파",
		title: "사랑하는 이야기를 만나다.",
		lead: `서로 다른 플랫폼과 언어에 흩어진 웹소설에서 시작합니다. ${BRAND}는 원작과 각 언어 표시, 연재 출처, 장, 커뮤니티를 다시 하나의 계속 진화하는 작품으로 연결합니다.`,
		explore: "웹소설 탐색",
		productsAction: "제품 살펴보기",
		problem: {
			title: "한 연재가 플랫폼, 언어, 번역 제목 때문에 조각나서는 안 됩니다.",
			body: "독자가 찾는 것은 같은 이야기이지만, 오늘날에는 플랫폼 페이지, 번역 제목 항목, 진행도 도구, 토론 그룹 사이에서 반복해서 확인해야 합니다. 작품이 갱신되어도 이 조각들이 함께 나아가지는 않습니다.",
		},
		promise: {
			title: "먼저 같은 작품을 다시 연결하고, 그다음 읽기와 커뮤니티가 자연스럽게 자라게 합니다.",
			body: `${BRAND}는 처음부터 다국어인 단위를 공동 출발점으로 삼습니다. 같은 작품이 여러 콘텐츠 언어를 담고, 연재는 플랫폼을 넘고, 장은 계속 늘어나며, ${REALM}은 서로 다른 관점을 만들 수 있습니다. 그래도 원작, 번역, 커뮤니티는 이해 가능하고 추적 가능한 하나의 정체성을 공유합니다.`,
		},
		principles: [
			{
				title: "플랫폼을 넘는 식별",
				body: `플랫폼 ${URL}은 출처이지 작품의 유일한 정체성이 아닙니다.`,
			},
			{
				title: "언어를 넘는 이해",
				body: "원제, 번역 제목, 별칭이 함께 독자가 같은 작품을 찾도록 돕습니다.",
			},
			{
				title: "계속되는 진화",
				body: "연재, 장, 판본, 진행도, 토론은 작품이 갱신될 때도 계속 축적될 수 있습니다.",
			},
		],
		model: {
			title: "웹소설은 입구이고, 기반은 계속 진화하는 모든 작품을 위해 설계됩니다.",
			body: "작품, 출처, 콘텐츠, 구조, 이력, 커뮤니티는 각각 명확한 경계를 지키고 명시적 관계로 협력합니다.",
			steps: [
				{
					title: "처음부터 다국어인 단위",
					body: "하나의 작품 정체성이 각 언어 표시를 처음부터 담아 이름, 콘텐츠, 플랫폼 출처가 서로 단절된 항목으로 나뉘지 않습니다.",
				},
				{
					title: "출처와 연재",
					body: `원 연재, 번역 출처, 출간판, 갱신 상태를 더 이상 하나의 ${URL}에 압축하지 않습니다.`,
				},
				{
					title: `읽기와 ${FOLLOW}`,
					body: "콘텐츠 구조가 장의 맥락을 보존하고, 진행도가 독자가 실제 위치에서 이어 읽게 합니다.",
				},
				{
					title: `${REALM}과 공동 지식`,
					body: `독자는 공동 관심사를 중심으로 ${koTerminology.realm.forms.pluralLabel}을 만들고, 토론·수정·발견이 오래 남게 합니다.`,
				},
			],
		},
		outcomes: {
			title: "먼저 오늘 독자의 문제를 해결하고, 내일의 작품 네트워크를 축적합니다.",
			body: `찾기, ${koTerminology.follow.forms.gerund}, 커뮤니티 참여, 관계 보완 하나하나가 다음 독자의 탐색 비용을 낮춥니다.`,
			cards: [
				{
					title: "찾기",
					body: `원제, 번역 제목, 별칭, 출처 ${URL}로 같은 웹소설을 찾습니다.`,
				},
				{
					title: "이어가기",
					body: "연재 갱신을 따라가고 읽기 상태와 마지막 위치를 저장합니다.",
				},
				{
					title: "만나기",
					body: `${REALM}에 들어가거나 만들어 같은 작품을 오래 이야기할 사람을 찾습니다.`,
				},
			],
		},
		open: {
			title: "큰 서사는 검증 가능한 토대 위에 세워져야 합니다.",
			body: `${BRAND}는 오픈 소스, 버전 의미론이 있는 콘텐츠 문서, ${koTerminology.license.forms.label}, 권한이 부여된 ${API}로 장기적으로 확장 가능한 경계를 만듭니다. 각 제품 페이지는 사용 가능·개발 중·계획됨을 명확히 구분합니다.`,
		},
		closing: {
			title: `지금 ${FOLLOW} 중인 웹소설 한 편에서 시작하세요.`,
			body: `원제나 번역 제목을 검색하고 읽기 맥락을 저장한 뒤, 누군가 이미 그 작품을 위한 ${REALM}을 만들었는지 확인하세요.`,
			action: `${BRAND} 시작하기`,
		},
		contact: {
			title: "함께 실현하고 싶은 아이디어가 있나요?",
			body: "제품 협업, 오픈 소스 참여, 콘텐츠 모델, 또는 더 잘 만들 수 있는 제안이라면 무엇이든 이야기해 주세요.",
			action: "문의하기",
		},
		v1: {
			identity: {
				title: "한 연재가 플랫폼, 언어, 번역 제목 때문에 조각나서는 안 됩니다.",
				body: `독자가 찾는 것은 같은 이야기이지만, 오늘날에는 플랫폼 페이지, 번역 제목 항목, 진행도 도구, 토론 그룹 사이에서 반복해서 확인해야 합니다. ${BRAND}는 먼저 그것들을 하나의 작품 정체성으로 다시 연결합니다.`,
				sourcesTitle: "플랫폼 간 출처",
				sources: [
					"원 연재 플랫폼",
					`번역 및 ${koTerminology.license.forms.label} 출처`,
					"출간 및 기타 판본",
				],
				namesTitle: "원제와 번역 제목",
				originalName: "원제, 로마자 표기, 별칭",
				translatedName: "언어별 공식 번역 제목과 관용 이름",
				updates: {
					title: "연재 갱신",
					body: "출처는 계속 갱신되어도 작품 정체성을 다시 만들 필요는 없습니다.",
				},
				progress: {
					title: "읽기 진행도",
					body: "작품이 어디까지 갱신되었는지와 내가 어디까지 읽었는지를 압니다.",
				},
				realm: {
					title: `${REALM} 동료 커뮤니티`,
					body: "작품에서 그것을 오래 이야기할 사람을 찾습니다.",
				},
				workTitle: "하나의 계속 진화하는 작품",
			},
			loop: {
				title: "책 한 권을 찾는 데서 쉽게 복제할 수 없는 작품 네트워크를 만드는 데까지.",
				body: `40만 권의 출시 카탈로그가 콜드 스타트를 해결합니다. 진짜로 계속 축적되는 것은 플랫폼 간 정체성, 언어 간 관계, 읽기 흔적, ${REALM}의 커뮤니티 기억입니다.`,
				steps: [
					{
						title: "플랫폼을 넘어 작품 찾기",
						body: "원제, 번역 제목, 별칭, 출처가 하나의 정체성을 가리킵니다.",
					},
					{
						title: `${FOLLOW}: 연재와 진행도`,
						body: "어디에서 읽는지, 어디까지 갱신됐는지, 내가 어디까지 읽었는지 압니다.",
					},
					{
						title: `${REALM}에 참여하거나 만들기`,
						body: "작품에서 정말 오랫동안 이야기할 사람을 찾습니다.",
					},
					{
						title: "출처와 지식 기여",
						body: "이름, 판본, 관계, 커뮤니티 콘텐츠를 바로잡습니다.",
					},
					{
						title: "검색과 추천 개선",
						body: "모든 참여가 다음 독자의 탐색 비용을 낮춥니다.",
					},
				],
			},
			foundation: {
				title: "웹소설은 입구이고, 기반은 계속 진화하는 모든 작품을 위해 설계됩니다.",
				body: `${BRAND}는 작품 정체성, 출처, 콘텐츠, 구조, 이력, 커뮤니티를 명확한 경계로 나누고 명시적 관계로 협력하게 합니다.`,
				pillars: [
					{
						title: "처음부터 다국어인 단위",
						body: "하나의 작품 정체성이 각 언어 표시, 플랫폼 출처, 대표 항목/변형, 병합 거버넌스를 담습니다.",
					},
					{
						title: "콘텐츠 구조",
						body: "장은 재사용 가능한 콘텐츠이고, 구조는 순서·출현 위치·연재의 진화를 관리합니다.",
					},
					{
						title: `${BLOCK_SCHEMA} + ${PORTABLE_TEXT}`,
						body: `타입·키·버전 의미론을 가진 진화 가능한 문서이며, 서식 있는 텍스트는 원시 ${JSON}이 아닙니다.`,
					},
					{
						title: `${REALM}과 공동 기억`,
						body: "커뮤니티는 작품을 소유하지 않지만 토론, 거버넌스, 지식은 오래 축적될 수 있습니다.",
					},
				],
				closing:
					"웹소설에서 시작해 작품과 공동 지식이 전승되고, 창작되고, 퍼질 수 있는 네트워크를 만듭니다.",
			},
		},
	},
	uses: {
		eyebrow: "독자가 먼저 가치를 얻습니다",
		title: "책을 찾고, 연재를 따라가고, 이어 읽고, 진짜 동료를 만납니다.",
		lead: `독자는 콘텐츠 단위, 블록, 콘텐츠 구조를 먼저 이해할 필요가 없습니다. 익숙한 제목, 플랫폼, 언어에서 시작하면 ${BRAND}가 뒤에서 정체성과 관계를 연결합니다.`,
		resultLabel: "얻게 되는 것",
		journeys: [
			{
				title: "플랫폼을 넘어 같은 웹소설 찾기",
				body: `플랫폼 ${URL}, 원 연재, 번역 출처, 출간판에서 들어가 같은 작품 정체성으로 돌아갑니다.`,
				result: "더 이상 모든 플랫폼 항목을 다른 책으로 여기지 않습니다.",
			},
			{
				title: "익숙한 언어로 찾고 이해하기",
				body: "원제, 로마자 표기, 커뮤니티 관용 이름이 검색 입구가 되고, 같은 단위가 독자의 선호에 맞는 이름, 요약, 콘텐츠를 표시합니다.",
				result: "언어를 넘어도 원작이나 기존 커뮤니티를 떠날 필요가 없습니다.",
			},
			{
				title: `연재를 ${koTerminology.follow.forms.action}하고 지난 위치에서 이어가기`,
				body: "출처가 어느 장까지 갱신됐는지, 작품이 연재 중인지 완결인지 확인하고 자신의 읽기 상태와 마지막 위치를 저장합니다.",
				result: "작품은 갱신되어도 읽기 맥락은 처음부터 다시 만들 필요가 없습니다.",
			},
			{
				title: `${REALM}에 참여하거나 만들기`,
				body: `작품 페이지에서 ${REALM}에 들어가 같은 작품, 장르, 읽기 취향을 중심으로 장기 토론과 공동 규칙을 만듭니다.`,
				result: "작품을 찾는 데서 진짜 동료를 찾는 데로 나아갑니다.",
			},
			{
				title: "출처, 이름, 작품 관계 보완",
				body: "번역 제목, 플랫폼 출처, 시리즈, 발행, 창작자, 주제 관계를 바로잡고 거버넌스와 이력 맥락을 보존하도록 돕습니다.",
				result: "모든 수정이 다음 독자가 더 빨리 답을 찾도록 돕습니다.",
			},
			{
				title: "자신의 글과 작품 콘텐츠 게시",
				body: `${PORTABLE_TEXT}로 ${koTerminology.post.forms.label}을 편집하고 ${BLOCK_SCHEMA}로 진화 가능한 문서를 보존하며 콘텐츠 구조로 장과 게시 이력을 배치합니다.`,
				result: "콘텐츠는 읽기만 하는 것이 아니라 인용·재사용·지속적 수정도 가능합니다.",
			},
			{
				title: "공개 인터페이스로 새 입구 만들기",
				body: `개발자는 현재 ${API}와 명확히 범위가 정해진 토큰으로 접근할 수 있습니다. ${OAUTH} 및 ${MCP} 통합은 각 제품 페이지에 표시된 단계에 따라 점진적으로 열립니다.`,
				result: "지금 무엇을 쓸 수 있는지와 다음 단계가 어디를 향하는지를 모두 공개합니다.",
			},
		],
		closing: {
			title: "이 활용 방식 뒤에서 어떤 제품들이 함께 작동하는지 보고 싶나요?",
			body: "각 제품 페이지는 사용자에게 주는 결과에서 시작해 함께 참여하는 제품, 현재 단계, 서로의 관계를 펼쳐 보입니다.",
			action: "제품 살펴보기",
		},
	},
	products: {
		eyebrow: "제품",
		title: "작품을 찾고, 이해하고, 모으고, 함께 이어 갑니다.",
		lead: `각 작품은 먼저 처음부터 다국어인 하나의 단위에 언어별 표시, 관계, 개정을 보존합니다. 언어를 넘는 책 목록, 태그와 커뮤니티 분류, 위키, ${REALM}이 그 작품을 다른 언어의 독자와 커뮤니티로 이어 줍니다.`,
		openProduct: "제품 보기",
		stage: {
			legend: "제품 상태",
			current: "현재 상태",
			labels: { available: "사용 가능", development: "개발 중", planned: "계획됨" },
		},
	},
	product: {
		breadcrumbHome: "홈",
		breadcrumbProducts: "제품",
		related: "함께 작동하는 제품",
		readNext: "제품 네트워크 계속 살펴보기",
		enter: `${BRAND} 시작하기`,
	},
	footer: {
		statement: "사랑하는 이야기를 만나고 공동 지식을 이어받고, 만들고, 퍼뜨립니다.",
		explore: "탐색",
		project: "프로젝트",
		source: `${GITHUB} 소스`,
		mainSite: "메인 사이트",
		copyright: `© 2026 ${REZICS_INC}`,
		license: AGPL30,
	},
	notFound: {
		title: "페이지를 찾을 수 없습니다",
		body: "주소가 바뀌었거나 이 콘텐츠가 아직 존재하지 않습니다.",
		back: "홈으로",
	},
} satisfies SiteCopy;
