import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHansTerminology } from "@rezics/i18n/terminology/zh-Hans";

const { forms: realmTerms } = zhHansTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "让作品、关系、讨论与知识共同生长。",
	socialDescription: `链接作品、${realmTerms.plural}与深度讨论。`,
	pwaDescription: `发现作品，加入${realmTerms.plural}，展开深度讨论。`,
} satisfies typeof import("../zh-Hant/brand").default;
