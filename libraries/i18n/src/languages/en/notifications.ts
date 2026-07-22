import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: followTerms } = enTerminology.follow;
const { forms: realmTerms } = enTerminology.realm;

export default {
	center: {
		title: "Notifications",
		description: "Review recent activity and system updates that need your attention.",
		headerLabel: "Notifications",
		headerUnreadLabel: insert("Notifications, {{count}} unread", { count: Number }),
		receivedInvitations: "Received access invitations",
		invitationsDescription:
			"Review and respond to Unit access invitations sent to you by other people.",
		backToNotifications: "Back to notifications",
		markAllRead: "Mark all as read",
		markRead: "Mark as read",
		loadMore: "Load more notifications",
		unread: "Unread",
		emptyTitle: "No notifications yet",
		emptyDescription: "New activity and system updates will appear here.",
	},
	reply: {
		title: `New reply on ${verbatimTerms.rezics.value}`,
		body: "Someone replied to a conversation you joined.",
	},
	new_follower: {
		title: `New ${followTerms.follower} on ${verbatimTerms.rezics.value}`,
		body: `Someone started ${followTerms.gerund} you.`,
	},
	direct_message: {
		title: `New message on ${verbatimTerms.rezics.value}`,
		body: "You received a new direct message.",
	},
	moderation: {
		title: `${verbatimTerms.rezics.value} moderation update`,
		body: "The moderation status of your content changed.",
	},
	realm: {
		title: `${verbatimTerms.rezics.value} ${realmTerms.label} update`,
		body: `Something changed in a ${realmTerms.inline} you belong to.`,
	},
	system: {
		title: `${verbatimTerms.rezics.value} system notification`,
		body: "You received a system notification.",
	},
	unit_access_invitation: {
		title: "New access invitation",
		body: "Someone invited you to access a Unit. Review the invitation before responding.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
