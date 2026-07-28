import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	versions: "Versions",
	publishedVersions: "Versions publiées",
	fieldHistory: "Historique du champ",
	diff: "Différence entre les champs",
	locked: "Ce champ est verrouillé dans le périmètre d’édition actif",
	bookTitle: String(verbatimTerms.bookTitleField.value),
	postBlock: String(verbatimTerms.postBlockField.value),
	zoneConfig: String(verbatimTerms.zoneConfigField.value),
	publishedVersionC: "Version C publiée",
	publishedVersionB: "Version B publiée",
	publishedVersionA: "Version A publiée",
	current: "actuelle",
	previous: "précédente",
	initial: "initiale",
	previousTitle: "Titre précédent",
	currentTitle: "Titre publié actuel",
	postBlockHistory: `Historique des blocs de ${frTerminology.post.forms.inline}`,
	previousPostBlock: `${verbatimTerms.paragraphBlockField.value} / version B publiée`,
	currentPostBlock: `${verbatimTerms.paragraphBlockField.value} / version C publiée`,
	zoneConfigurationHistory: `Historique de la configuration de l’${frTerminology.zone.forms.inline}`,
	previousZoneQuery: `${verbatimTerms.feedQueryField.value} / version A publiée`,
	currentZoneQuery: `${verbatimTerms.feedQueryField.value} / version B publiée`,
} satisfies typeof import("../../en/components/history").default;

export default content;
