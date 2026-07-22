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
};
