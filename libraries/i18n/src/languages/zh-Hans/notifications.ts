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
		detailsActorFallback: "相关用户",
		detailsOpenSubject: "查看相关条目",
		detailsOpenActor: insert("查看 {{name}} 的个人资料", { name: String }),
		detailsOpenPublicNotice: "查看公开说明",
		detailsTargetUnavailable: "相关内容已不可用，或你当前没有访问权限。",
	},
	followingSettings: {
		triggerEnabled: `打开${followTerms.actionLabel}通知设置；站内通知已开启`,
		triggerDisabled: `打开${followTerms.actionLabel}通知设置；站内通知已关闭`,
		title: `${followTerms.actionLabel}通知设置`,
		description: `选择这个${followTerms.collectionLabel}的站内通知与个性化来源。`,
		inAppTitle: "站内通知",
		inAppDescription: `让这个${followTerms.collectionLabel}支持的更新显示在通知中心。`,
		realmTagSourceTitle: `加载${realmTerms.label}标签投票`,
		realmTagSourceDescription: `将这个${realmTerms.inline}纳入你的标签来源，并在条目详情页显示其标签投票结果。此设置不会产生通知。`,
		unfollowKeepsRealmTagSource: `${followTerms.undoActionLabel}不会移除这个${realmTerms.inline}的标签来源。`,
		cancel: "取消",
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
	unit_ownership_override: {
		title: "条目所有权已变更",
		body: "平台管理员变更了一个与你个人资料相关的条目所有权。",
	},
	unit_ownership_claim_approved: {
		title: "条目所有权认领已批准",
		body: "这个条目的管理所有权已转移到你的个人资料。",
	},
	unit_ownership_claim_rejected: {
		title: "条目所有权认领未获批准",
		body: "平台治理人员已拒绝你提出的条目所有权认领。",
	},
	unit_ownership_claim_superseded: {
		title: "条目所有权认领已结束",
		body: "另一项认领已获批准，因此你提出的认领已自动结束。",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
