import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	reply: {
		title: `New reply on ${verbatimTerms.rezics.value}`,
		body: "Someone replied to a conversation you joined.",
	},
	new_follower: {
		title: `New follower on ${verbatimTerms.rezics.value}`,
		body: "Someone started following you.",
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
		title: `${verbatimTerms.rezics.value} Realm update`,
		body: "Something changed in a Realm you belong to.",
	},
	system: {
		title: `${verbatimTerms.rezics.value} system notification`,
		body: "You received a system notification.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
