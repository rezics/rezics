import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	unitTypes: "Unit の種類",
	identity: "Catalog の同一性",
	description:
		"Work 抽象は設けません。Catalog の各 Unit が独自の同一性と main / variants 関係を保持します。",
	book: "Book",
	media: "Media",
	software: "Software",
	series: "Series",
	mainVariants: "main + variants",
	composition: "構成",
	selectedIdentity: "選択中の同一性",
	canonicalUnit: "正規 Unit",
	stableId: `安定 ${verbatimTerms.id.value}`,
	release: "Release",
	editionContext: "版のコンテキスト",
	attribution: "帰属",
	entityRelations: "Entity 関係",
} satisfies typeof import("../../en/components/catalog").default;

export default content;
