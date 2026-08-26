import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: entityTerms } = deTerminology.entity;

export default {
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
	centimetreUnit: "cm",
	kilogramUnit: "kg",
	newEntity: `Neue ${entityTerms.label}`,
	newTag: "Neuer Tag",
	externalLinksDescription: `Öffentliche Seiten, die Angaben zu dieser ${entityTerms.inline} belegen.`,
	externalLinksEmpty: "Noch keine externen Links vorhanden.",
	relatedContentTitle: "Zugehörige Inhalte",
	relatedContentDescription: `Inhalte, die mit dieser ${entityTerms.inline} verknüpft sind.`,
	relatedContentEmptyTitle: "Keine zugehörigen Inhalte",
	relatedContentEmptyDescription: "Derzeit sind keine zugehörigen Inhalte verfügbar.",
} satisfies typeof import("../zh-Hant/entities").default;
