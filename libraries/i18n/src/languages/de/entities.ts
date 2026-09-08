import { deTerminology } from "@rezics/i18n/terminology/de";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = deTerminology.entity;

export default {
	fixedProfile: {
		title: "Grunddaten",
		typeRevisionId: "Kennung der Typdefinitionsrevision",
		genderRevisionId: "Kennung der Geschlechtsdefinitionsrevision",
		areaId: "Gebietseintrag",
		beginAreaId: "Eintrag des Ursprungsgebiets",
		endAreaId: "Eintrag des Endgebiets",
		begin: "Beginn",
		end: "Ende",
		ended: "Beendet",
		referenceNotice:
			"Für Typ und Geschlecht die genauen Kennungen der Definitionsrevisionen und für Orte die Kennungen bestehender Gebietseinträge eingeben. Unbekannte Werte leer lassen.",
		remove: "Grunddaten entfernen",
		removed: "Grunddaten entfernt",
		resolve: "Genauen Typ bestätigen",
		resolveNotice:
			"Der genaue Typ kann nur bestätigt werden, solange er ungeklärt ist. Andere Änderungen zuerst speichern.",
	},
	contextMeasurements: {
		title: "Maße im jeweiligen Kontext",
		context: "Zugehöriger Inhalt",
		chooseContext: "Zugehörigen Inhalt wählen",
		noVisibleMeasurement: "Für diesen Kontext sind derzeit keine Maße sichtbar.",
		edit: "Maße für diesen Kontext bearbeiten",
		millimetres: "Millimeter",
		grams: "Gramm",
		scopeNotice:
			"Diese Werte gelten nur für den gewählten Inhalt. Beim Speichern wird der vollständige Maßsatz dieses Kontexts ersetzt.",
		unknownNotice: "Unbekannte Werte bleiben leer. Null wird als Null gespeichert.",
		invalid:
			"Gib nichtnegative ganze Zahlen im unterstützten Bereich ein oder lasse unbekannte Werte leer.",
		save: "Maße für diesen Kontext speichern",
	},
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Art",
	verification: "Bestätigung",
	owner: "Eigentümer",
	verified: "Bestätigt",
	unverified: "Nicht bestätigt",
	measurements: "Körpermaße",
	height: "Größe",
	weight: "Gewicht",
	bust: "Brustumfang",
	waist: "Taillenumfang",
	hips: "Hüftumfang",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `Neue ${entityTerms.label}`,
	newTag: "Neuer Tag",
	externalLinksDescription: `Öffentliche Seiten, die Angaben zu dieser ${entityTerms.inline} belegen.`,
	externalLinksEmpty: "Noch keine externen Links vorhanden.",
	relatedContentTitle: "Zugehörige Inhalte",
	relatedContentDescription: `Inhalte, die mit dieser ${entityTerms.inline} verknüpft sind.`,
	relatedContentEmptyTitle: "Keine zugehörigen Inhalte",
	relatedContentEmptyDescription: "Derzeit sind keine zugehörigen Inhalte verfügbar.",
} satisfies typeof import("../zh-Hant/entities").default;
