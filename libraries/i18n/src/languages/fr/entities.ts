import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = frTerminology.entity;

export default {
	contextMeasurements: {
		title: "Mensurations selon le contexte",
		context: "Contenu associé",
		chooseContext: "Choisir le contenu associé",
		noVisibleMeasurement: "Aucune mensuration actuelle n’est visible pour ce contexte.",
		edit: "Modifier les mensurations de ce contexte",
		millimetres: "millimètres",
		grams: "grammes",
		scopeNotice:
			"Ces valeurs ne s’appliquent qu’au contenu choisi. L’enregistrement remplace l’ensemble de ses mensurations.",
		unknownNotice: "Laissez les valeurs inconnues vides. Zéro est enregistré comme zéro.",
		invalid:
			"Saisissez des entiers positifs ou nuls dans la plage prise en charge, ou laissez les valeurs inconnues vides.",
		save: "Enregistrer les mensurations de ce contexte",
	},
	entities: entityTerms.pluralLabel,
	tags: "Tags",
	kind: "Type",
	verification: "Vérification",
	owner: "Propriétaire",
	verified: "Vérifié",
	unverified: "Non vérifié",
	measurements: "Mensurations",
	height: "Taille",
	weight: "Poids",
	bust: "Tour de poitrine",
	waist: "Tour de taille",
	hips: "Tour de hanches",
	centimetreUnit: verbatimTerms.centimetreUnitSymbol.value,
	kilogramUnit: verbatimTerms.kilogramUnitSymbol.value,
	newEntity: `Nouvelle ${entityTerms.inline}`,
	newTag: "Nouveau tag",
	externalLinksDescription: `Pages publiques étayant les informations sur cette ${entityTerms.inline}.`,
	externalLinksEmpty: "Aucun lien externe pour le moment.",
	relatedContentTitle: "Contenus associés",
	relatedContentDescription: `Contenus associés à cette ${entityTerms.inline}.`,
	relatedContentEmptyTitle: "Aucun contenu associé",
	relatedContentEmptyDescription: "Il n’y a pas encore de contenu associé à afficher.",
} satisfies typeof import("../zh-Hant/entities").default;
