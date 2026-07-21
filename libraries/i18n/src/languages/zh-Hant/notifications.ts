import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: followTerms } = zhHantTerminology.follow;
const { forms: realmTerms } = zhHantTerminology.realm;

export default {
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
};
