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
	owners: {
		...feed.content.owners,
		publishing: deTerminology.publishingCatalog.forms.entryLabel,
		reference: deTerminology.referenceCatalog.forms.entryLabel,
		tag: "Tag",
		poll: "Umfrage",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": deTerminology.publishingWork.forms.label,
		"publishing:text_version": deTerminology.textVersion.forms.label,
		"publishing:publication": deTerminology.publication.forms.label,
		"music:recording": deTerminology.musicRecording.forms.label,
		"music:release": deTerminology.musicRelease.forms.label,
		"music:release_group": deTerminology.musicReleaseGroup.forms.label,
		"program:program": deTerminology.program.forms.label,
		"software:content": deTerminology.softwareContent.forms.label,
		"software:version": deTerminology.softwareVersion.forms.label,
		"software:release": deTerminology.softwareRelease.forms.label,
		"grouping:grouping": deTerminology.grouping.forms.label,
		"reference:concept": deTerminology.referenceConcept.forms.label,
		"distribution:package": deTerminology.distributionPackage.forms.label,
		"video:video": deTerminology.video.forms.label,
		"audio:audio": deTerminology.audio.forms.label,
		"zone:zone": deTerminology.zone.forms.label,
		"realm:realm": deTerminology.realm.forms.label,
		"post:chapter": deTerminology.chapter.forms.label,
		"post:post": deTerminology.post.forms.label,
		"post:excerpt": deTerminology.post.forms.label,
		"post:review": deTerminology.post.forms.label,
		"post:wiki": deTerminology.post.forms.label,
		"post:picture": deTerminology.post.forms.label,
		"tag:tag": "Tag",
		"poll:poll": "Umfrage",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Startseite" },
} satisfies typeof import("../zh-Hant/seo").default;
