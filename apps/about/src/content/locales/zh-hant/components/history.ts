import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "版本",
	publishedVersions: "已發布版本",
	fieldHistory: "欄位歷史",
	diff: "欄位差異",
	locked: "此欄位目前在編輯範圍內被鎖定",
	bookTitle: verbatimTerms.bookTitleField.value,
	postBlock: verbatimTerms.postBlockField.value,
	zoneConfig: verbatimTerms.zoneConfigField.value,
	publishedVersionC: "已發布版本 C",
	publishedVersionB: "已發布版本 B",
	publishedVersionA: "已發布版本 A",
	current: "目前",
	previous: "上一版",
	initial: "初始版本",
	previousTitle: "上一版標題",
	currentTitle: "目前已發布標題",
	postBlockHistory: `${zhHantTerminology.post.forms.label}內容區塊歷史`,
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / 已發布 B`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / 已發布 C`,
	zoneConfigurationHistory: `${zhHantTerminology.zone.forms.label}配置歷史`,
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / 已發布 A`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / 已發布 B`,
} satisfies typeof import("../../en/components/history").default;

export default content;
