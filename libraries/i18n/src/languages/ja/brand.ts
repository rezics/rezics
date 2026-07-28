import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { jaTerminology } from "@rezics/i18n/terminology/ja";

const { forms: realmTerms } = jaTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "オブジェクト、関係、議論、知識が共に成長する場所。",
	socialDescription: `作品、${realmTerms.pluralLabel}、そして考え抜かれた議論がつながる場所。`,
	pwaDescription: `作品を発見し、${realmTerms.pluralLabel}に参加し、考え抜かれた議論に参加しましょう。`,
} satisfies typeof import("../zh-Hant/brand").default;
