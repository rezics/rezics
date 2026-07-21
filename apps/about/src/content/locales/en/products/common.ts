import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../../productRegistry";
import type { ProductCapabilityMode, ProductManifestationKind } from "../../../productTypes";

const content = {
	breadcrumbsHome: "Home",
	breadcrumbsProducts: "Products",
	names: {
		catalog: "Catalog",
		book: "Book",
		gamebook: "GameBook",
		media: "Media",
		software: "Software",
		series: "Series",
		release: "Release",
		post: "Post",
		wiki: "Wiki",
		picture: "Picture",
		review: "Review",
		collection: "Collection",
		library: "Library",
		realm: "Realm",
		zone: "Zone",
		comment: "Comment",
		score: "Score",
		"content-structure": "Content Structure",
		history: "History",
		editor: "Editor",
		feed: "Feed",
		tag: "Tag",
		progress: "Progress",
		entity: "Entity",
		"api-oauth": `${verbatimTerms.api.value} & ${verbatimTerms.oauth.value}`,
	} satisfies Record<ProductId, string>,
	manifestationFormulas: {
		gamebook: `Book + ${verbatimTerms.gameContentStructure.value} → GameBook`,
		wiki: `Post(${verbatimTerms.kindWiki.value}) → Wiki`,
		picture: `Post(${verbatimTerms.kindPicture.value}) → Picture`,
		review: `Post(${verbatimTerms.kindReview.value}) → Review`,
		library: `${verbatimTerms.collectionArray.value} → Library`,
	} satisfies Record<ProductManifestationKind, string>,
	capabilityModeLabels: {
		ContentStructure: String(verbatimTerms.contentStructure.value),
		GameContentStructure: String(verbatimTerms.gameContentStructure.value),
		Entity: "Entity",
		CreditAttribution: String(verbatimTerms.creditAttribution.value),
		SubjectAssociation: String(verbatimTerms.subjectAssociation.value),
	} satisfies Record<ProductCapabilityMode, string>,
	scenarios: "Concrete scenarios",
	workflow: "Core workflow",
	capabilities: "Shared capabilities used",
	boundaries: "Product boundaries",
	faq: "Frequently asked questions",
	statusLabel: "Status",
	classificationLabel: "Class",
	consumers: "Products using this capability",
	sectionEyebrows: {
		use: "Use",
		workflow: "Workflow",
		platform: "Platform",
		scope: "Scope",
		faq: "FAQ",
		next: "Next",
	},
};

export default content;
