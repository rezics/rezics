import { insert } from "native-i18n";

import { enTerminology } from "@rezics/i18n/terminology/en";
import ui from "./ui";
import feed from "./feed";

const { forms: metadataTerms } = enTerminology.metadata;

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
	owners: feed.content.owners,
	shapes: feed.content.kinds,
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Home" },
} satisfies typeof import("../zh-Hant/seo").default;
