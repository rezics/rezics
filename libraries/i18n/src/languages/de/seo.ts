import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";
import ui from "./ui";
import feed from "./feed";

const { forms: metadataTerms } = deTerminology.metadata;

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
		restricted: insert("Eingeschränkter Inhalt | {{brand}}", { brand: String }),
		unavailable: insert("Seiteninformationen nicht verfügbar | {{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("Die {{kind}}-Seite „{{name}}“ auf {{brand}} ansehen.", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: `Die Inhaltsfreigabe dieser Seite ist von ${metadataTerms.label} für die Suchindexierung ausgeschlossen.`,
		unavailable:
			"Die öffentlichen Informationen dieser Seite sind derzeit nicht für die Suchindexierung verfügbar.",
	},
	owners: feed.content.owners,
	shapes: feed.content.kinds,
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Startseite" },
} satisfies typeof import("../zh-Hant/seo").default;
