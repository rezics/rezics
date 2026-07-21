import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "版本",
	publishedVersions: "已发布版本",
	fieldHistory: "字段历史",
	diff: "字段差异",
	locked: "此字段当前在编辑范围内被锁定",
	bookTitle: verbatimTerms.bookTitleField.value,
	postBlock: verbatimTerms.postBlockField.value,
	zoneConfig: verbatimTerms.zoneConfigField.value,
	publishedVersionC: "已发布版本 C",
	publishedVersionB: "已发布版本 B",
	publishedVersionA: "已发布版本 A",
	current: "当前",
	previous: "上一版",
	initial: "初始版本",
	previousTitle: "上一版标题",
	currentTitle: "当前已发布标题",
	postBlockHistory: "Post 内容块历史",
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / 已发布 B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / 已发布 C`,
	zoneConfigurationHistory: "Zone 配置历史",
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / 已发布 A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / 已发布 B`,
} satisfies typeof import("../../en/components/history").default;

export default content;
