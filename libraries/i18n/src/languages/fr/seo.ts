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
	owners: {
		...feed.content.owners,
		publishing: frTerminology.publishingCatalog.forms.entryLabel,
		reference: frTerminology.referenceCatalog.forms.entryLabel,
		tag: "étiquette",
		poll: "sondage",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": frTerminology.publishingWork.forms.label,
		"publishing:text_version": frTerminology.textVersion.forms.label,
		"publishing:publication": frTerminology.publication.forms.label,
		"music:recording": frTerminology.musicRecording.forms.label,
		"music:release": frTerminology.musicRelease.forms.label,
		"music:release_group": frTerminology.musicReleaseGroup.forms.label,
		"program:program": frTerminology.program.forms.label,
		"software:content": frTerminology.softwareContent.forms.label,
		"software:version": frTerminology.softwareVersion.forms.label,
		"software:release": frTerminology.softwareRelease.forms.label,
		"grouping:grouping": frTerminology.grouping.forms.label,
		"reference:concept": frTerminology.referenceConcept.forms.label,
		"distribution:package": frTerminology.distributionPackage.forms.label,
		"video:video": frTerminology.video.forms.label,
		"audio:audio": frTerminology.audio.forms.label,
		"zone:zone": frTerminology.zone.forms.label,
		"realm:realm": frTerminology.realm.forms.label,
		"post:chapter": frTerminology.chapter.forms.label,
		"post:post": frTerminology.post.forms.label,
		"post:excerpt": frTerminology.post.forms.label,
		"post:review": frTerminology.post.forms.label,
		"post:wiki": frTerminology.post.forms.label,
		"post:picture": frTerminology.post.forms.label,
		"tag:tag": "étiquette",
		"poll:poll": "sondage",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Accueil" },
} satisfies typeof import("../zh-Hant/seo").default;
