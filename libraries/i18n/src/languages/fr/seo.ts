import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = frTerminology.audio;
const { forms: entityTerms } = frTerminology.entity;
const { forms: metadataTerms } = frTerminology.metadata;
const { forms: postTerms } = frTerminology.post;
const { forms: realmTerms } = frTerminology.realm;
const { forms: videoTerms } = frTerminology.video;
const { forms: zoneTerms } = frTerminology.zone;

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
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		release: units.types.release,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "étiquette",
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `page de ${zoneTerms.inline}`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "sondage",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Accueil" },
} satisfies typeof import("../zh-Hant/seo").default;
