import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";
import ui from "./ui";
import units from "./units";

const { forms: audioTerms } = enTerminology.audio;
const { forms: entityTerms } = enTerminology.entity;
const { forms: metadataTerms } = enTerminology.metadata;
const { forms: postTerms } = enTerminology.post;
const { forms: realmTerms } = enTerminology.realm;
const { forms: tagPathTerms } = enTerminology.tagPath;
const { forms: videoTerms } = enTerminology.video;
const { forms: zoneTerms } = enTerminology.zone;

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
		restricted: insert("Restricted content | {{brand}}", { brand: String }),
		unavailable: insert("Page information unavailable | {{brand}}", { brand: String }),
	},
	descriptions: {
		fallback: insert("View the {{kind}} “{{name}}” on {{brand}}.", {
			brand: String,
			name: String,
			kind: String,
		}),
		restricted: `This page’s content rating is not eligible for search indexing ${metadataTerms.inline}.`,
		unavailable: "Public information for this page is currently unavailable for search indexing.",
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
		zone_page: `${zoneTerms.label} page`,
		collection: ui.collection,
		post: postTerms.label,
		poll: "Poll",
		realm: realmTerms.label,
	},
	entityKinds: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Home" },
} satisfies typeof import("../zh-Hant/seo").default;
