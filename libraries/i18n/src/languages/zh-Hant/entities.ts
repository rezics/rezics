import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: entityTerms } = zhHantTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "標籤",
	kind: "類別",
	verification: "驗證狀態",
	owner: "擁有者",
	verified: "已驗證",
	unverified: "未驗證",
	measurements: "身體數值",
	height: "身高",
	weight: "體重",
	bust: "胸圍",
	waist: "腰圍",
	hips: "臀圍",
	centimetreUnit: "公分",
	kilogramUnit: "公斤",
	newEntity: `建立${entityTerms.label}`,
	newTag: "建立標籤",
	externalLinksDescription: `可佐證此${entityTerms.inline}資訊的公開頁面。`,
	externalLinksEmpty: "目前沒有外部連結。",
	relatedContentTitle: "相關內容",
	relatedContentDescription: `與此${entityTerms.inline}相關的內容。`,
	relatedContentEmptyTitle: "尚無相關內容",
	relatedContentEmptyDescription: "目前沒有可顯示的相關內容。",
};
