import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";
import ui from "./ui";
import feed from "./feed";

const { forms: metadataTerms } = frTerminology.metadata;

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
		restricted: insert("Contenu restreint | {{brand}}", { brand: String }),
		unavailable: insert("Informations de page indisponibles | {{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("Consultez la page {{kind}} « {{name}} » sur {{brand}}.", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: `La classification de cette page exclut la fourniture de ${metadataTerms.inline} destinées à l’indexation.`,
		unavailable:
			"Les informations publiques de cette page sont actuellement indisponibles pour l’indexation.",
	},
	owners: feed.content.owners,
	shapes: feed.content.kinds,
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Accueil" },
} satisfies typeof import("../zh-Hant/seo").default;
