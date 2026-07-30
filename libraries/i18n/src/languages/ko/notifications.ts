import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: followTerms } = koTerminology.follow;
const { forms: realmTerms } = koTerminology.realm;

export default {
	center: {
		title: "알림",
		description: "주의가 필요한 최근 활동 및 시스템 업데이트 검토.",
		headerLabel: "알림",
		headerUnreadLabel: insert("알림, {{count}} 읽지 않음", { count: Number }),
		receivedInvitations: "받은 접근 초대",
		invitationsDescription: "다른 사람이 보낸 유닛 접근 초대 검토 및 응답.",
		backToNotifications: "알림으로 돌아가기",
		markAllRead: "모두 읽음으로 표시",
		markRead: "읽음으로 표시",
		loadMore: "더 많은 알림 불러오기",
		unread: "읽지 않음",
		emptyTitle: "아직 알림 없음",
		emptyDescription: "새로운 활동 및 시스템 업데이트가 여기에 나타납니다.",
	},
	followingSettings: {
		triggerEnabled: `${followTerms.actionLabel} 알림 설정 열기. 앱 내 알림 켜짐`,
		triggerDisabled: `${followTerms.actionLabel} 알림 설정 열기. 앱 내 알림 꺼짐`,
		title: `${followTerms.actionLabel} 알림 설정`,
		description: `이 ${followTerms.actionLabel} 항목의 앱 내 알림과 개인화 소스를 선택하세요.`,
		inAppTitle: "앱 내 알림",
		inAppDescription: "이 항목에서 지원하는 업데이트를 알림 센터에 표시합니다.",
		realmTagSourceTitle: `${realmTerms.label} 태그 투표 불러오기`,
		realmTagSourceDescription: `이 ${realmTerms.inline}을 태그 소스에 추가하고 유닛 상세 페이지에 태그 투표 결과를 표시합니다. 이 설정은 알림을 만들지 않습니다.`,
		unfollowKeepsRealmTagSource: `${followTerms.undoActionLabel}해도 이 ${realmTerms.inline}은 태그 소스에서 제거되지 않습니다.`,
		cancel: "취소",
	},
	reply: {
		title: `${verbatimTerms.rezics.value}에 새 답글`,
		body: "당신이 참여한 대화에 누군가가 답글을 남겼습니다.",
	},
	new_follower: {
		title: `${verbatimTerms.rezics.value}에 새 ${followTerms.follower}`,
		body: `누군가가 당신에게 ${followTerms.gerund}를 시작했습니다.`,
	},
	direct_message: {
		title: `${verbatimTerms.rezics.value}에 새 메시지`,
		body: "새 직접 메시지를 받았습니다.",
	},
	moderation: {
		title: `${verbatimTerms.rezics.value} 모더레이션 업데이트`,
		body: "콘텐츠의 모더레이션 상태가 변경되었습니다.",
	},
	report_resolution: {
		title: `${verbatimTerms.rezics.value} 신고 처리 결과`,
		body: "제출한 신고의 처리 결과가 결정되었습니다.",
	},
	realm: {
		title: `${verbatimTerms.rezics.value} ${realmTerms.label} 업데이트`,
		body: `당신이 속한 ${realmTerms.inline}에서 변경사항이 있었습니다.`,
	},
	system: {
		title: `${verbatimTerms.rezics.value} 시스템 알림`,
		body: "시스템 알림을 받았습니다.",
	},
	unit_access_invitation: {
		title: "새 접근 초대",
		body: "누군가가 유닛 접근을 초대했습니다. 응답하기 전에 초대를 검토하세요.",
	},
	unit_ownership_override: {
		title: "유닛 소유권 변경",
		body: "플랫폼 관리자가 당신의 프로필과 관련된 유닛의 소유권을 변경했습니다.",
	},
	unit_ownership_claim_approved: {
		title: "유닛 소유권 요청 승인",
		body: "이 유닛의 관리 소유권이 당신의 프로필로 이전되었습니다.",
	},
	unit_ownership_claim_rejected: {
		title: "유닛 소유권 요청 미승인",
		body: "플랫폼 운영에서 소유권 요청을 거부했습니다.",
	},
	unit_ownership_claim_superseded: {
		title: "유닛 소유권 요청 종료",
		body: "다른 요청이 승인되어 당신의 요청이 자동으로 종료되었습니다.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
