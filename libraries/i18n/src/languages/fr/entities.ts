import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: entityTerms } = frTerminology.entity;

export default {
	fixedProfile: {
		title: "Informations générales",
		typeRevisionId: "Identifiant de révision du type",
		genderRevisionId: "Identifiant de révision du genre",
		areaId: "Entrée de la région",
		beginAreaId: "Entrée de la région d’origine",
		endAreaId: "Entrée de la région de fin",
		begin: "Début",
		end: "Fin",
		ended: "Terminé",
		referenceNotice:
			"Saisissez les identifiants exacts des révisions de définition pour le type et le genre, et ceux des entrées de région existantes pour les lieux. Laissez les valeurs inconnues vides.",
		remove: "Supprimer les informations générales",
		removed: "Informations générales supprimées",
		resolve: "Confirmer le type précis",
		resolveNotice:
			"Le type précis ne peut être confirmé que s’il est encore indéterminé. Enregistrez d’abord les autres modifications.",
	},
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
