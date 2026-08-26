import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = esTerminology.audio;
const { forms: entityTerms } = esTerminology.entity;
const { forms: metadataTerms } = esTerminology.metadata;
const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;
const { forms: videoTerms } = esTerminology.video;
const { forms: zoneTerms } = esTerminology.zone;

export default {
	titles: {
		standard: insert("{{name}} | {{brand}}", { name: String, brand: String }),
		typed: insert("{{name}} ({{kind}}) | {{brand}}", {
			name: String,
			kind: String,
			brand: String,
		}),
		profile: insert("{{name}} (@{{slug}}) | {{brand}}", {
			name: String,
			slug: String,
			brand: String,
		}),
		contextual: insert("{{name}} — {{context}} | {{brand}}", {
			name: String,
			context: String,
			brand: String,
		}),
		restricted: insert("Contenido restringido | {{brand}}", { brand: String }),
		unavailable: insert("Información de la página no disponible | {{brand}}", {
			brand: String,
		}),
	},
	descriptions: {
		fallback: insert("Consulta la página de {{kind}} «{{name}}» en {{brand}}.", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: `La clasificación de contenido de esta página no permite ${metadataTerms.inline} para la indexación de búsqueda.`,
		unavailable:
			"La información pública de esta página no está disponible actualmente para la indexación.",
	},
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		release: units.types.release,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "etiqueta",
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `página de ${zoneTerms.inline}`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "encuesta",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Inicio" },
} satisfies typeof import("../zh-Hant/seo").default;
