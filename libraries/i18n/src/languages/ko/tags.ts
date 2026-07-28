import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: realmTerms } = koTerminology.realm;
const { forms: followTerms } = koTerminology.follow;
const { forms: tagStructureTerms } = koTerminology.tagStructure;

export default {
	page: {
		title: "태그",
		description: "선택한 태그 소스가 만든 글로벌 태그 및 상황별 판단을 검토하십시오.",
		viewAll: "전체 태그 페이지 보기",
		manageOnTagPage: `전용 태그 페이지에서 태그와 ${tagStructureTerms.pluralLabel}를 추가하여 투표 컨텍스트가 보이도록 유지합니다.`,
	},
	card: {
		open: insert("{{tag}} 태그 카드 열기 ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "태그 카드 닫기",
		globalContext: "글로벌 태그",
		structureContext: tagStructureTerms.label,
		policy: `${realmTerms.label}-세트`,
		search: "이 태그 검색",
		details: "태그 세부 정보 보기",
	},
	selection: {
		start: "여러 개 선택",
		finish: "선택 완료",
		add: "선택에 추가",
		remove: "선택에서 제거",
		addNamed: insert("{{tag}} 선택", { tag: String }),
		removeNamed: insert("{{tag}} 선택 해제", { tag: String }),
		selectedCount: insert("선택된 {{count}} 태그", { count: Number }),
		search: "선택한 태그 검색",
		clear: "선택 해제",
	},
	basic: {
		title: "기본 태그",
		description: `글로벌 태그와 ${tagStructureTerms.pluralLabel}, 모든 ${realmTerms.label}의 맥락적 판단 없이.`,
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `${tagStructureTerms.pluralLabel}는 의미 있는 계층을 유지하며 평면 태그 앞에 표시됩니다.`,
		addTitle: `${tagStructureTerms.inline} 추가`,
		addDescription: `먼저 승인된 ${tagStructureTerms.plural}를 검색하세요. 하나를 추가하면 경로와 그 위의 모든 태그를 지원합니다.`,
		add: `${tagStructureTerms.label} 추가`,
		create: `${tagStructureTerms.label} 만들기`,
		details: `${tagStructureTerms.label} 보기`,
		empty: `이 작업에는 아직 승인된 ${tagStructureTerms.plural}가 없습니다.`,
		memberFallback: "이름 없는 태그",
		pathLabel: `정렬된 ${tagStructureTerms.label}`,
	},
	detail: {
		childrenTitle: "직접 하위 태그",
		childrenDescription: `이러한 관계는 승인된, 커뮤니티 잠금된 ${tagStructureTerms.pluralLabel}에서 가져옵니다. 각 하위는 자신의 직접 하위를 표시합니다.`,
		noChildren: "이 태그에는 아직 승인된 직접 하위가 없습니다.",
		grandchildrenTitle: "직접 하위",
	},
	createStructure: {
		title: `${tagStructureTerms.label} 만들기`,
		description:
			"보다 넓은 태그에서 더 구체적인 태그로 정렬된 경로를 구축합니다. 커뮤니티 회원은 생성 후 편집할 수 없으며, 플랫폼 관리자는 감사된 수정을 할 수 있습니다.",
		pick: "다음 태그 선택",
		addMember: "경로에 추가",
		removeMember: "경로에서 제거",
		moveEarlier: "앞쪽으로 이동",
		moveLater: "뒤쪽으로 이동",
		preview: "커뮤니티 잠금 경로 미리보기",
		minimum: "적어도 두 개 이상의 서로 다른 태그를 추가하세요.",
		submit: `${tagStructureTerms.label}를 생성하고 투표하세요.`,
	},
	adminEditStructure: {
		title: `${tagStructureTerms.label}를 수정하세요.`,
		description:
			"플랫폼 관리자는 회원이나 순서를 수정할 수 있습니다. 유닛 정체성, 투표 및 신청은 유지되며, 수정 기록은 기록됩니다.",
		reasonLabel: "수정 사유",
		reasonPlaceholder: "왜 이 관리적 수정을 해야 하는지 설명하세요.",
		submit: "감사된 수정을 저장하세요.",
	},
	global: {
		title: "글로벌 태그",
		description: "글로벌 태그는 상호작용 접근 권한이 있는 모든 사람이 제안하고 판단합니다.",
		addTitle: "글로벌 태그 추가",
		addDescription: "먼저 기존 태그를 검색하세요. 추가하면 ‘적합’ 투표도 함께 진행됩니다.",
		add: "태그 추가",
		pinned: "고정됨",
		empty: "이 작품에는 아직 글로벌 태그가 없습니다.",
	},
	management: {
		title: "태그 선별",
		description:
			"먼저 표시할 글로벌 태그를 선택합니다. 나머지 태그는 커뮤니티 순위를 유지합니다.",
		featuredTitle: "추천 태그",
		featuredDescription:
			"추천 태그는 설정한 순서대로 먼저 표시됩니다. 드래그하거나 이동 버튼을 사용하세요.",
		rankedTitle: "커뮤니티 순위 태그",
		rankedDescription: "나머지 글로벌 태그는 커뮤니티 투표에 따라 자동으로 정렬됩니다.",
		feature: "추천으로 설정",
		unfeature: "추천 해제",
		moveEarlier: "앞으로 이동",
		moveLater: "뒤로 이동",
		drag: insert("{{tag}} 태그를 드래그하여 순서 변경", { tag: String }),
		instructions:
			"스페이스바를 눌러 추천 태그를 집고, 방향키로 이동한 다음 스페이스바를 다시 눌러 놓으세요.",
		pickedUp: insert("{{tag}} 태그를 집었습니다.", { tag: String }),
		over: insert("{{tag}} 태그가 전체 {{count}}개 중 {{position}}번째 위치에 있습니다.", {
			tag: String,
			position: Number,
			count: Number,
		}),
		cancelled: insert("{{tag}} 태그 이동을 취소했습니다.", { tag: String }),
		featuredAnnouncement: insert("{{tag}} 태그를 {{position}}번째 추천 태그로 설정했습니다.", {
			tag: String,
			position: Number,
		}),
		unfeaturedAnnouncement: insert("{{tag}} 태그의 추천을 해제했습니다.", {
			tag: String,
		}),
		movedAnnouncement: insert("{{tag}} 태그를 {{position}}번째로 이동했습니다.", {
			tag: String,
			position: Number,
		}),
		noFeatured: "아직 추천 태그가 없습니다.",
		noRanked: "추천으로 설정할 다른 글로벌 태그가 없습니다.",
	},
	realms: {
		title: `${realmTerms.label} 태그 문맥`,
		description: `각 ${realmTerms.inline}는 독립적인 문맥입니다. 그 판단은 글로벌 태그나 다른 ${realmTerms.inline}과 결합되지 않습니다.`,
		policy: `${realmTerms.label}-세트 태그`,
		votes: `${realmTerms.label} 회원 투표`,
		context: "투표 문맥 보기",
		empty: "선택한 태그 출처가 이 작품을 아직 판단하지 않았습니다.",
		cannotVote: `컨텍스트 투표에 참여하려면 이 ${realmTerms.inline}에 가입하세요.`,
	},
	vote: {
		fits: "적합",
		doesNotFit: "적합하지 않음",
		clear: "내 판단 제거",
		signIn: "투표하려면 로그인하세요",
		signInDescription: "글로벌 태그 컨텍스트에서 투표하려면 로그인하세요.",
		summary: insert("순 {{score}} · {{count}} 표", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "태그 소스",
		description: `작업 태그 화면에 표시되는 ${realmTerms.plural}를 선택하고 순서를 정하세요. 이것은 작업을 ${followTerms.action}하거나 ${realmTerms.inline} 멤버십을 변경하지 않습니다.`,
		addTitle: "태그 소스를 추가하세요",
		addDescription: `읽을 수 있는 ${realmTerms.plural}를 검색하고 개인 태그 소스 목록에 하나 추가하세요.`,
		add: "소스 추가",
		remove: "소스 제거",
		moveEarlier: "앞쪽으로 이동",
		moveLater: "뒤쪽으로 이동",
		empty: "선택된 태그 소스가 없습니다.",
		manage: "태그 소스 관리",
	},
	unnamedTag: "이름 없는 태그",
	unnamedRealm: `이름 없는 ${realmTerms.label}`,
	unnamedStructure: `이름 없는 ${tagStructureTerms.label}`,
} satisfies typeof import("../zh-Hant/tags").default;
