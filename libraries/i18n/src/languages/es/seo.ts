import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";
import ui from "./ui";
import feed from "./feed";

const { forms: metadataTerms } = esTerminology.metadata;

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
	owners: feed.content.owners,
	shapes: feed.content.kinds,
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Inicio" },
} satisfies typeof import("../zh-Hant/seo").default;
