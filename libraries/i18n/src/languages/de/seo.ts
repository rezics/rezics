import { insert } from "native-i18n";

import { deTerminology } from "@rezics/i18n/terminology/de";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = deTerminology.audio;
const { forms: entityTerms } = deTerminology.entity;
const { forms: metadataTerms } = deTerminology.metadata;
const { forms: postTerms } = deTerminology.post;
const { forms: realmTerms } = deTerminology.realm;
const { forms: tagPathTerms } = deTerminology.tagPath;
const { forms: videoTerms } = deTerminology.video;
const { forms: zoneTerms } = deTerminology.zone;

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
	kinds: {
		profile: ui.profile,
		book: units.types.book,
		software: units.types.software,
		release: units.types.release,
		media: units.types.media,
		video: videoTerms.label,
		audio: audioTerms.label,
		entity: entityTerms.label,
		tag: "Tag",
		structure: tagPathTerms.label,
		series: units.types.series,
		zone: zoneTerms.label,
		zone_page: `${zoneTerms.label}-Seite`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "Umfrage",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Startseite" },
} satisfies typeof import("../zh-Hant/seo").default;
