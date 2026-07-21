import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../../productRegistry";

const content = {
	breadcrumbsHome: "Start",
	breadcrumbsProducts: "Produkte",
	names: {
		catalog: "Katalog",
		book: "Buch",
		gamebook: "Spielbuch",
		media: "Medien",
		software: "Software",
		series: "Reihe",
		release: "Veröffentlichung",
		post: deTerminology.post.forms.label,
		wiki: "Wiki",
		picture: "Bild",
		review: "Rezension",
		collection: "Sammlung",
		library: "Bibliothek",
		realm: deTerminology.realm.forms.label,
		zone: deTerminology.zone.forms.label,
		comment: "Kommentar",
		score: "Bewertung",
		"content-structure": "Inhaltsstruktur",
		history: "Verlauf",
		editor: "Editor",
		feed: "Feed",
		tag: "Schlagwort",
		progress: "Fortschritt",
		entity: "Entität",
		"api-oauth": `${verbatimTerms.api.value} und ${verbatimTerms.oauth.value}`,
	} satisfies Record<ProductId, string>,
	manifestationFormulas: {
		gamebook: "Buch + Spielstruktur → Spielbuch",
		wiki: `${deTerminology.post.forms.label} (${verbatimTerms.kindWiki.value}) → Wiki`,
		picture: `${deTerminology.post.forms.label} (${verbatimTerms.kindPicture.value}) → Bild`,
		review: `${deTerminology.post.forms.label} (${verbatimTerms.kindReview.value}) → Rezension`,
		library: `Sammlung (${verbatimTerms.collectionArray.value}) → Bibliothek`,
	},
	capabilityModeLabels: {
		ContentStructure: "Inhaltsstruktur",
		GameContentStructure: "Spielinhaltsstruktur",
		Entity: "Entität",
		CreditAttribution: "Beitragszuordnung",
		SubjectAssociation: "Themenzuordnung",
	},
	scenarios: "Konkrete Nutzung",
	workflow: "Kernablauf",
	capabilities: "Genutzte Plattformfähigkeiten",
	boundaries: "Produktgrenzen",
	faq: "Häufige Fragen",
	statusLabel: "Status",
	classificationLabel: "Klasse",
	consumers: "Nutzende Produkte",
	sectionEyebrows: {
		use: "Nutzung",
		workflow: "Ablauf",
		platform: "Plattform",
		scope: "Umfang",
		faq: "Häufige Fragen",
		next: "Weiterführend",
	},
} satisfies typeof import("../../en/products/common").default;

export default content;
