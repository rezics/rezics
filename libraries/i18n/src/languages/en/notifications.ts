import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { enTerminology } from "@rezics/i18n/terminology/en";

const { forms: followTerms } = enTerminology.follow;
const { forms: realmTerms } = enTerminology.realm;

export default {
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
} satisfies typeof import("../zh-Hant/notifications").default;
