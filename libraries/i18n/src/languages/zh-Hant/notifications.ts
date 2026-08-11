import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: followTerms } = zhHantTerminology.follow;
const { forms: realmTerms } = zhHantTerminology.realm;

export default {
	center: {
		title: "通知",
		description: "查看需要你留意的最新活動與系統更新。",
		headerLabel: "通知",
		headerUnreadLabel: insert("通知，{{count}} 則未讀", { count: Number }),
		receivedInvitations: "收到的存取邀請",
		invitationsDescription: "檢視並回應其他使用者傳送給你的條目存取邀請。",
		backToNotifications: "返回通知",
		markAllRead: "全部標示為已讀",
		markRead: "標示為已讀",
		loadMore: "載入更多通知",
		unread: "未讀",
		emptyTitle: "目前沒有通知",
		emptyDescription: "新的活動與系統更新會顯示在這裡。",
		detailsActorFallback: "相關使用者",
		detailsOpenSubject: "查看相關條目",
		detailsOpenActor: insert("查看 {{name}} 的個人檔案", { name: String }),
		detailsOpenPublicNotice: "查看公開說明",
		detailsTargetUnavailable: "相關內容已無法使用，或你目前沒有存取權限。",
	},
	followingSettings: {
		triggerEnabled: `開啟${followTerms.actionLabel}通知設定；站內通知已開啟`,
		triggerDisabled: `開啟${followTerms.actionLabel}通知設定；站內通知已關閉`,
		title: `${followTerms.actionLabel}通知設定`,
		description: `選擇這個${followTerms.collectionLabel}的站內通知與個人化來源。`,
		inAppTitle: "站內通知",
		inAppDescription: `讓這個${followTerms.collectionLabel}支援的更新顯示在通知中心。`,
		realmTagSourceTitle: `載入${realmTerms.label}標籤投票`,
		realmTagSourceDescription: `將這個${realmTerms.inline}納入你的標籤來源，並在條目詳情頁顯示其標籤投票結果。這項設定不會產生通知。`,
		unfollowKeepsRealmTagSource: `${followTerms.undoActionLabel}不會移除這個${realmTerms.inline}的標籤來源。`,
		cancel: "取消",
	},
	reply: {
		title: `${verbatimTerms.rezics.value} 有新的回覆`,
		body: "有人回覆了你參與的內容。",
	},
	new_follower: {
		title: `${verbatimTerms.rezics.value} 有新的${followTerms.follower}`,
		body: `有人開始${followTerms.action}你。`,
	},
	direct_message: {
		title: `${verbatimTerms.rezics.value} 有新的私人訊息`,
		body: "你收到了一則新的私人訊息。",
	},
	moderation: {
		title: `${verbatimTerms.rezics.value} 內容審核更新`,
		body: "你的內容審核狀態已變更。",
	},
	report_resolution: {
		title: `${verbatimTerms.rezics.value} 檢舉處理結果`,
		body: "你提交的檢舉已有處理結果。",
	},
	realm: {
		title: `${verbatimTerms.rezics.value} ${realmTerms.inline}更新`,
		body: `你所在${realmTerms.inline}的相關狀態已變更。`,
	},
	system: {
		title: `${verbatimTerms.rezics.value} 系統通知`,
		body: "你收到了一則系統通知。",
	},
	unit_access_invitation: {
		title: "收到新的存取邀請",
		body: "有人邀請你存取一個條目。請檢視邀請內容後再決定是否接受。",
	},
	unit_ownership_override: {
		title: "條目所有權已變更",
		body: "平台管理員變更了一個與你個人檔案相關的條目所有權。",
	},
	unit_ownership_claim_approved: {
		title: "條目所有權認領已核准",
		body: "這個條目的管理所有權已移轉到你的個人檔案。",
	},
	unit_ownership_claim_rejected: {
		title: "條目所有權認領未獲核准",
		body: "平台治理人員已拒絕你提出的條目所有權認領。",
	},
	unit_ownership_claim_superseded: {
		title: "條目所有權認領已結束",
		body: "另一項認領已獲核准，因此你提出的認領已自動結束。",
	},
};
