import { insert } from "native-i18n";

import { koTerminology } from "@rezics/i18n/terminology/ko";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = koTerminology.realm;
const { forms: postTerms } = koTerminology.post;

export default {
	title: "관리 콘솔",
	description:
		"플랫폼 기능은 각 관리 작업을 활성화합니다. 이는 사용자 신원이나 고용 관계를 나타내지 않습니다.",
	backToApplication: "애플리케이션으로 돌아가기",
	navigation: "관리 콘솔 탐색",
	overview: "모든 관리 기능",
	cancel: "취소",
	sections: {
		access: {
			label: "플랫폼 접근",
			description:
				"각 권한의 만료 및 출처를 포함하여 프로필에 부여된 플랫폼 기능을 검사하거나 관리합니다.",
		},
		moderation: {
			label: "전역 콘텐츠 거버넌스",
			description:
				"전역 규칙에 따라 제출된 신고를 처리하고 유닛의 플랫폼 수준 상태를 관리합니다.",
		},
		audit: {
			label: "보안 감사",
			description: `플랫폼, ${realmTerms.pluralLabel}, 그리고 유닛 전반의 영향력이 큰 관리 이벤트와 보안 결정을 검토합니다.`,
		},
	},
	access: {
		searchTitle: "프로필 찾기",
		searchLabel: "이름 또는 로그인 이메일",
		searchPlaceholder: "이름이나 이메일 입력",
		search: "검색",
		searchResults: "검색 결과",
		activeProfiles: "활성화된 플랫폼 접근 권한이 있는 프로필",
		noProfiles: "활성화된 플랫폼 기능 부여가 없습니다.",
		noSearchResults: "일치하는 프로필이 없습니다.",
		selectProfile: "프로필을 선택하여 플랫폼 접근을 검사하세요.",
		capabilityCount: insert("{{count}} 기능", { count: Number }),
		capability: "기능",
		expiry: "만료",
		expiryFor: insert("{{capability}}의 만료", { capability: String }),
		noExpiry: "만료 없음",
		provenance: "권한 부여 출처",
		grantProvenance: insert("{{date}}에 {{profileId}}가 부여함", {
			profileId: String,
			date: String,
		}),
		notGranted: "직접 부여되지 않음",
		readOnly: "플랫폼 접근 권한을 확인할 수 있지만 변경할 수 없습니다.",
		grantAll: "모든 권한 부여",
		clearAll: "모든 권한 삭제",
		save: "플랫폼 접근 권한 저장",
		revokeAllTitle: "이 프로필의 모든 플랫폼 접근 권한을 취소하시겠습니까?",
		revokeAllDescription:
			"이는 모든 활성 권한 부여를 취소합니다. 만료되지 않는 마지막 플랫폼 접근 관리자 권한을 제거할 경우 서버에서 변경을 거부합니다.",
		confirmRevokeAll: "전체 취소 확인",
	},
	moderation: {
		filterState: "사건 상태",
		allStates: "모든 상태",
		queue: "전역 신고 사건",
		empty: "현재 필터에 일치하는 전역 신고 사건이 없습니다.",
		untitled: "제목 없는 유닛",
		reports: "이 사건의 신고",
		action: "거버넌스 작업",
		reason: "거버넌스 사유",
		internalNote: "내부 메모(선택)",
		notePlaceholder: "판단 근거를 기록하세요. 메모 추가 작업에서는 필수입니다.",
		submit: "거버넌스 작업 적용",
		succeeded: "전역 거버넌스 작업을 완료했습니다",
		confirmRemovalTitle: "이 콘텐츠를 플랫폼에서 삭제할까요?",
		confirmRemovalDescription: insert("{{title}}이 플랫폼 수준에서 삭제됨으로 표시됩니다.", {
			title: String,
		}),
		confirmRemoval: "콘텐츠 삭제",
		reportCount: insert("신고 {{count}}건", { count: Number }),
		moderationStatuses: {
			approved: "승인됨",
			pending: "검토 대기",
			removed: "삭제됨",
		},
		targetingLocked: `새 ${postTerms.label} 연결 차단됨`,
		targetingUnlocked: `새 ${postTerms.label} 연결 허용됨`,
		openContent: "콘텐츠 열기",
	},
	audit: {
		category: "이벤트 범주",
		allCategories: "모든 범주",
		categories: {
			admin_activity: "관리 활동",
			policy_denied: "정책 거부",
			system_event: "시스템 이벤트",
		},
		outcome: "결과",
		allOutcomes: "모든 결과",
		outcomes: {
			succeeded: "성공",
			denied: "거부됨",
			failed: "실패",
		},
		time: "시간",
		action: "작업",
		actor: "수행자",
		authority: "권한",
		authorities: {
			platform: "플랫폼",
			realm: realmTerms.label,
			unit: "유닛",
		},
		empty: "현재 필터에 일치하는 감사 이벤트가 없습니다.",
		previousPage: "이전 페이지",
		nextPage: "다음 페이지",
		selectEvent: "전체 감사 기록을 확인하려면 이벤트를 선택하세요.",
		detailsTitle: "이벤트 세부 정보",
		systemActor: "시스템",
		credential: "자격 증명 종류",
		credentialId: `자격 증명 ${verbatimTerms.id.value}`,
		credentials: {
			session: "대화형 세션",
			api_token: `${verbatimTerms.api.value} 토큰`,
			bootstrap: "시스템 부트스트랩",
			system: "시스템 프로세스",
		},
		scopedAuthority: insert("{{kind}} ({{id}})", { kind: String, id: String }),
		target: "대상",
		noTarget: "특정 대상 없음",
		reasonCode: "사유 코드",
		requestId: `요청 ${verbatimTerms.id.value}`,
		traceId: `추적 ${verbatimTerms.id.value}`,
		rawDetails: "구조화된 세부 정보",
	},
} satisfies typeof import("../zh-Hant/console").default;
