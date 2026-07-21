import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const content = {
	consumers: "使用此能力的产品",
	zone: zhHansTerminology.zone.forms.label,
	realm: zhHansTerminology.realm.forms.label,
	home: "首页",
	zoneFeed: `${zhHansTerminology.zone.forms.label}动态`,
	realmFeed: `${zhHansTerminology.realm.forms.label}动态`,
	homeFeed: "首页动态",
	postCard: `${zhHansTerminology.post.forms.label}卡片`,
	bookCard: "Book 卡片",
	commentCard: "Comment 卡片",
	kindAware: "按 kind 区分",
	catalog: "Catalog",
	discussion: "讨论",
	consumerConfiguration: "消费端配置",
	query: "查询",
	consumerScope: "消费端范围",
	card: "卡片",
	perFeature: "按功能",
	order: "顺序",
	feedOrder: "Feed 顺序",
} satisfies typeof import("../../en/components/feed").default;

export default content;
