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
	newEntity: `建立${entityTerms.label}`,
	newTag: "建立標籤",
};
