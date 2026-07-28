import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../../productRegistry";
import type { ProductCapabilityMode, ProductManifestationKind } from "../../../productTypes";

const content = {
	breadcrumbsHome: "Accueil",
	breadcrumbsProducts: "Produits",
	names: {
		catalog: "Catalogue",
		book: "Livre",
		gamebook: "Livre-jeu",
		media: "Média",
		software: "Logiciel",
		series: "Série",
		release: "Version",
		post: frTerminology.post.forms.label,
		wiki: "Wiki",
		picture: "Image",
		review: "Avis",
		collection: "Collection",
		library: "Bibliothèque",
		realm: frTerminology.realm.forms.label,
		zone: frTerminology.zone.forms.label,
		comment: "Commentaire",
		score: "Note",
		"content-structure": "Structure de contenu",
		history: "Historique",
		editor: "Éditeur",
		feed: "Fil",
		tag: "Étiquette",
		progress: "Progression",
		entity: "Entité",
		"api-oauth": `${verbatimTerms.api.value} et ${verbatimTerms.oauth.value}`,
		token: `Jeton ${verbatimTerms.api.value}`,
	} satisfies Record<ProductId, string>,
	manifestationFormulas: {
		gamebook: `Livre + ${verbatimTerms.gameContentStructure.value} → Livre-jeu`,
		wiki: `${frTerminology.post.forms.label} (${verbatimTerms.kindWiki.value}) → Wiki`,
		picture: `${frTerminology.post.forms.label} (${verbatimTerms.kindPicture.value}) → Image`,
		review: `${frTerminology.post.forms.label} (${verbatimTerms.kindReview.value}) → Avis`,
		library: `${verbatimTerms.collectionArray.value} → Bibliothèque`,
	} satisfies Record<ProductManifestationKind, string>,
	capabilityModeLabels: {
		ContentStructure: String(verbatimTerms.contentStructure.value),
		GameContentStructure: String(verbatimTerms.gameContentStructure.value),
		Entity: "Entité",
		CreditAttribution: String(verbatimTerms.creditAttribution.value),
		SubjectAssociation: String(verbatimTerms.subjectAssociation.value),
	} satisfies Record<ProductCapabilityMode, string>,
	scenarios: "Scénarios concrets",
	workflow: "Flux de travail principal",
	capabilities: "Capacités partagées utilisées",
	boundaries: "Périmètre du produit",
	faq: "Questions fréquentes",
	statusLabel: "État",
	classificationLabel: "Classe",
	consumers: "Produits utilisant cette capacité",
	sectionEyebrows: {
		use: "Utilisation",
		workflow: "Flux de travail",
		platform: "Plateforme",
		scope: "Périmètre",
		faq: "FAQ",
		next: "Ensuite",
	},
} satisfies typeof import("../../en/products/common").default;

export default content;
