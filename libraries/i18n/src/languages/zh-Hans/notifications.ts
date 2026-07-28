import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: followTerms } = zhHansTerminology.follow;
const { forms: realmTerms } = zhHansTerminology.realm;

export default {
	center: {
		title: "通知",
		description: "查看需要你留意的最新活动与系统更新。",
		headerLabel: "通知",
		headerUnreadLabel: insert("通知，{{count}} 则未读", { count: Number }),
		receivedInvitations: "收到的访问邀请",
		invitationsDescription: "查看并回应其他用户发送给你的条目访问邀请。",
		backToNotifications: "返回通知",
		markAllRead: "全部标示为已读",
		markRead: "标示为已读",
		loadMore: "加载更多通知",
		unread: "未读",
		emptyTitle: "当前没有通知",
		emptyDescription: "新的活动与系统更新会显示在这里。",
	},
	reply: {
		title: `${verbatimTerms.rezics.value} 有新的回复`,
		body: "有人回复了你参与的内容。",
	},
	new_follower: {
		title: `${verbatimTerms.rezics.value} 有新的${followTerms.follower}`,
		body: `有人开始${followTerms.action}你。`,
	},
	direct_message: {
		title: `${verbatimTerms.rezics.value} 有新的私人消息`,
		body: "你收到了一则新的私人消息。",
	},
	moderation: {
		title: `${verbatimTerms.rezics.value} 内容审核更新`,
		body: "你的内容审核状态已变更。",
	},
	report_resolution: {
		title: `${verbatimTerms.rezics.value} 举报处理结果`,
		body: "你提交的举报已有处理结果。",
	},
	realm: {
		title: `${verbatimTerms.rezics.value} ${realmTerms.inline}更新`,
		body: `你所在${realmTerms.inline}的相关状态已变更。`,
	},
	system: {
		title: `${verbatimTerms.rezics.value} 系统通知`,
		body: "你收到了一则系统通知。",
	},
	unit_access_invitation: {
		title: "收到新的访问邀请",
		body: "有人邀请你访问一个条目。请查看邀请内容后再决定是否接受。",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
