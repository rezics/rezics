import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ProductId } from "../../../productRegistry";
import type { ProductCapabilityMode, ProductManifestationKind } from "../../../productTypes";

const content = {
	breadcrumbsHome: "Inicio",
	breadcrumbsProducts: "Productos",
	names: {
		catalog: "Catálogo",
		book: "Libro",
		gamebook: "Librojuego",
		media: "Medios",
		software: "Software",
		series: "Serie",
		release: "Lanzamiento",
		post: esTerminology.post.forms.label,
		wiki: "Wiki",
		picture: "Imagen",
		review: "Reseña",
		collection: "Colección",
		library: "Biblioteca",
		realm: esTerminology.realm.forms.label,
		zone: esTerminology.zone.forms.label,
		comment: "Comentario",
		score: "Puntuación",
		"content-structure": "Estructura de contenido",
		history: "Historial",
		editor: "Editor",
		feed: "Flujo",
		tag: "Etiqueta",
		progress: "Progreso",
		entity: "Entidad",
		"api-oauth": `${verbatimTerms.api.value} y ${verbatimTerms.oauth.value}`,
		token: `Token de ${verbatimTerms.api.value}`,
	} satisfies Record<ProductId, string>,
	manifestationFormulas: {
		gamebook: `Libro + ${verbatimTerms.gameContentStructure.value} → Librojuego`,
		wiki: `${esTerminology.post.forms.label}(${verbatimTerms.kindWiki.value}) → Wiki`,
		picture: `${esTerminology.post.forms.label}(${verbatimTerms.kindPicture.value}) → Imagen`,
		review: `${esTerminology.post.forms.label}(${verbatimTerms.kindReview.value}) → Reseña`,
		library: `${verbatimTerms.collectionArray.value} → Biblioteca`,
	} satisfies Record<ProductManifestationKind, string>,
	capabilityModeLabels: {
		ContentStructure: String(verbatimTerms.contentStructure.value),
		GameContentStructure: String(verbatimTerms.gameContentStructure.value),
		Entity: "Entidad",
		CreditAttribution: String(verbatimTerms.creditAttribution.value),
		SubjectAssociation: String(verbatimTerms.subjectAssociation.value),
	} satisfies Record<ProductCapabilityMode, string>,
	scenarios: "Casos concretos",
	workflow: "Flujo de trabajo principal",
	capabilities: "Capacidades compartidas utilizadas",
	boundaries: "Límites del producto",
	faq: "Preguntas frecuentes",
	statusLabel: "Estado",
	classificationLabel: "Clase",
	consumers: "Productos que usan esta capacidad",
	sectionEyebrows: {
		use: "Uso",
		workflow: "Flujo de trabajo",
		platform: "Plataforma",
		scope: "Alcance",
		faq: "Preguntas frecuentes",
		next: "Siguiente",
	},
} satisfies typeof import("../../en/products/common").default;

export default content;
