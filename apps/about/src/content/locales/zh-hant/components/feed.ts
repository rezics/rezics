import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const content = {
	consumers: "使用此能力的產品",
	zone: zhHantTerminology.zone.forms.label,
	realm: zhHantTerminology.realm.forms.label,
	home: "首頁",
	zoneFeed: `${zhHantTerminology.zone.forms.label}動態`,
	realmFeed: `${zhHantTerminology.realm.forms.label}動態`,
	homeFeed: "首頁動態",
	postCard: `${zhHantTerminology.post.forms.label}卡片`,
	bookCard: "書籍卡片",
	commentCard: "留言卡片",
	kindAware: "依類型區分",
	catalog: "作品目錄",
	discussion: "討論",
	consumerConfiguration: "消費端配置",
	query: "查詢",
	consumerScope: "消費端範圍",
	card: "卡片",
	perFeature: "按功能",
	order: "順序",
	feedOrder: "動態排序",
} satisfies typeof import("../../en/components/feed").default;

export default content;
