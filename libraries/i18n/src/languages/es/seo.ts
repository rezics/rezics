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
	owners: {
		...feed.content.owners,
		publishing: esTerminology.publishingCatalog.forms.entryLabel,
		reference: esTerminology.referenceCatalog.forms.entryLabel,
		tag: "etiqueta",
		poll: "encuesta",
		collection: ui.collection,
	},
	shapes: {
		...feed.content.kinds,
		"publishing:work": esTerminology.publishingWork.forms.label,
		"publishing:text_version": esTerminology.textVersion.forms.label,
		"publishing:publication": esTerminology.publication.forms.label,
		"music:recording": esTerminology.musicRecording.forms.label,
		"music:release": esTerminology.musicRelease.forms.label,
		"music:release_group": esTerminology.musicReleaseGroup.forms.label,
		"program:program": esTerminology.program.forms.label,
		"software:content": esTerminology.softwareContent.forms.label,
		"software:version": esTerminology.softwareVersion.forms.label,
		"software:release": esTerminology.softwareRelease.forms.label,
		"grouping:grouping": esTerminology.grouping.forms.label,
		"reference:concept": esTerminology.referenceConcept.forms.label,
		"distribution:package": esTerminology.distributionPackage.forms.label,
		"video:video": esTerminology.video.forms.label,
		"audio:audio": esTerminology.audio.forms.label,
		"zone:zone": esTerminology.zone.forms.label,
		"realm:realm": esTerminology.realm.forms.label,
		"post:chapter": esTerminology.chapter.forms.label,
		"post:post": esTerminology.post.forms.label,
		"post:excerpt": esTerminology.post.forms.label,
		"post:review": esTerminology.post.forms.label,
		"post:wiki": esTerminology.post.forms.label,
		"post:picture": esTerminology.post.forms.label,
		"tag:tag": "etiqueta",
		"poll:poll": "encuesta",
		"collection:collection": ui.collection,
	},
	entityShapes: { person: ui.person, organization: ui.organization, character: ui.character },
	breadcrumbs: { home: "Inicio" },
} satisfies typeof import("../zh-Hant/seo").default;
