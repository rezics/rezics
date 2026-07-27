import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: postTerms } = zhHantTerminology.post;
const { forms: realmTerms } = zhHantTerminology.realm;
const { forms: zoneTerms } = zhHantTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "集中查看及管理您建立的內容。",
		backToApplication: `返回 ${verbatimTerms.rezics.value}`,
		navigation: `${verbatimTerms.studio.value} 導覽`,
		overview: "內容類型",
		backToOverview: "返回內容類型",
	},
	sections: {
		book: { label: "書籍", description: "查看及建立您的書籍。" },
		software: { label: "軟體", description: "查看及建立您的軟體條目。" },
		media: { label: "媒體", description: "查看及建立您的媒體內容。" },
		entity: { label: "目錄條目", description: "查看及建立您的目錄條目。" },
		tag: { label: "標籤", description: "查看及建立您的標籤。" },
		realm: { label: realmTerms.label, description: `查看及建立您的${realmTerms.label}。` },
		zone: { label: zoneTerms.label, description: `查看及建立您的${zoneTerms.label}。` },
		post: { label: postTerms.label, description: `查看及建立您的${postTerms.label}。` },
		collection: { label: "收藏集", description: "查看及建立您的收藏集。" },
		review: { label: "評論", description: "查看及建立您的評論。" },
		poll: { label: "投票", description: "查看及建立您的投票。" },
	},
	list: {
		create: "建立",
		empty: "您尚未建立這類內容。",
		untitled: "未命名內容",
	},
	developmentBadge: "開發中",
};
