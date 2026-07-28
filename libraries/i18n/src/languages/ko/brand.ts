import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: realmTerms } = koTerminology.realm;

export default {
	name: verbatimTerms.rezics.value,
	description: "객체, 관계, 토론, 지식이 함께 성장하는 곳.",
	socialDescription: `작품, ${realmTerms.pluralLabel}, 그리고 사려 깊은 토론이 연결되는 곳.`,
	pwaDescription: `작품을 발견하고, ${realmTerms.pluralLabel}에 가입하며, 사려 깊은 토론에 참여하세요.`,
} satisfies typeof import("../zh-Hant/brand").default;
