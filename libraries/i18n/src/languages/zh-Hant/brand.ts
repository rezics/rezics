import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { zhHantTerminology } from "@rezics/i18n/terminology/zh-Hant";

const { forms: realmTerms } = zhHantTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "讓作品、關係、討論與知識共同生長。",
	socialDescription: `連結作品、${realmTerms.plural}與深度討論。`,
	pwaDescription: `發現作品，加入${realmTerms.plural}，展開深度討論。`,
};
