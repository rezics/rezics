import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	unitTypes: "Unit 유형",
	identity: "Catalog 정체성",
	description:
		"Work 추상화를 두지 않습니다. 각 Catalog Unit은 고유한 정체성과 main / variants 관계를 유지합니다.",
	book: "Book",
	media: "Media",
	software: "Software",
	series: "Series",
	mainVariants: "main + variants",
	composition: "구성",
	selectedIdentity: "선택한 정체성",
	canonicalUnit: "표준 Unit",
	stableId: `안정적 ${verbatimTerms.id.value}`,
	release: "Release",
	editionContext: "판 컨텍스트",
	attribution: "귀속",
	entityRelations: "Entity 관계",
} satisfies typeof import("../../en/components/catalog").default;

export default content;
