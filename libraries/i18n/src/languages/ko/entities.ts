import { koTerminology } from "@rezics/i18n/terminology/ko";

const { forms: entityTerms } = koTerminology.entity;

export default {
	entities: entityTerms.pluralLabel,
	tags: "태그",
	kind: "종류",
	verification: "검증",
	owner: "소유자",
	verified: "검증됨",
	unverified: "검증되지 않음",
	newEntity: `새 ${entityTerms.label}`,
	newTag: "새 태그",
} satisfies typeof import("../zh-Hant/entities").default;
