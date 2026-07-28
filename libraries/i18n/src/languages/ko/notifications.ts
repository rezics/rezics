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
} satisfies typeof import("../zh-Hant/notifications").default;
