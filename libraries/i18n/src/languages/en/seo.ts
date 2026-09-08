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
	owners: {
		...feed.content.owners,
		publishing: enTerminology.publishingCatalog.forms.entryLabel,
		reference: enTerminology.referenceCatalog.forms.entryLabel,
		tag: "Tag",
		poll: "Poll",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": enTerminology.publishingWork.forms.label,
		"publishing:text_version": enTerminology.textVersion.forms.label,
		"publishing:publication": enTerminology.publication.forms.label,
		"music:recording": enTerminology.musicRecording.forms.label,
		"music:release": enTerminology.musicRelease.forms.label,
		"music:release_group": enTerminology.musicReleaseGroup.forms.label,
		"program:program": enTerminology.program.forms.label,
		"software:content": enTerminology.softwareContent.forms.label,
		"software:version": enTerminology.softwareVersion.forms.label,
		"software:release": enTerminology.softwareRelease.forms.label,
		"grouping:grouping": enTerminology.grouping.forms.label,
		"reference:concept": enTerminology.referenceConcept.forms.label,
		"distribution:package": enTerminology.distributionPackage.forms.label,
		"video:video": enTerminology.video.forms.label,
		"audio:audio": enTerminology.audio.forms.label,
		"zone:zone": enTerminology.zone.forms.label,
		"realm:realm": enTerminology.realm.forms.label,
		"post:chapter": enTerminology.chapter.forms.label,
		"post:post": enTerminology.post.forms.label,
		"post:excerpt": enTerminology.post.forms.label,
		"post:review": enTerminology.post.forms.label,
		"post:wiki": enTerminology.post.forms.label,
		"post:picture": enTerminology.post.forms.label,
		"tag:tag": "Tag",
		"poll:poll": "Poll",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Home" },
} satisfies typeof import("../zh-Hant/seo").default;
