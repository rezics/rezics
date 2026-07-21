import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;

export default {
	title: "建立內容",
	description: "選擇要建立的內容類型。",
	items: {
		book: "書籍",
		software: "軟體",
		media: "媒體",
		entity: "目錄條目",
		tag: "標籤",
		realm: realmTerms.label,
		post: postTerms.label,
		collection: "收藏集",
		review: "評論",
		poll: "投票",
	},
};
