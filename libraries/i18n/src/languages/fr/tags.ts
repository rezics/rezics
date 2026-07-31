import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = frTerminology.realm;
const { forms: followTerms } = frTerminology.follow;
const { forms: tagStructureTerms } = frTerminology.tagStructure;

export default {
	page: {
		title: "Étiquettes",
		description:
			"Consultez les étiquettes globales et les appréciations contextuelles formulées par les sources d’étiquettes que vous avez choisies.",
		viewAll: "Afficher la page complète de l’étiquette",
		manageOnTagPage: `Ajoutez des étiquettes et des ${tagStructureTerms.plural} sur la page dédiée afin que leur contexte de vote reste visible.`,
	},
	card: {
		open: insert("Ouvrir la fiche de l’étiquette {{tag}} ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "Fermer la fiche de l’étiquette",
		globalContext: "Contexte global",
		structureContext: tagStructureTerms.label,
		policy: `Définie par le ${realmTerms.inline}`,
		search: "Rechercher cette étiquette",
		details: "Afficher les détails de l’étiquette",
	},
	selection: {
		start: "Sélection multiple",
		finish: "Terminer la sélection",
		add: "Ajouter à la sélection",
		remove: "Retirer de la sélection",
		addNamed: insert("Sélectionner {{tag}}", { tag: String }),
		removeNamed: insert("Désélectionner {{tag}}", { tag: String }),
		selectedCount: insert("{{count}} étiquettes sélectionnées", { count: Number }),
		search: "Rechercher parmi les étiquettes sélectionnées",
		clear: "Effacer la sélection",
	},
	basic: {
		title: "Étiquettes de base",
		description: `Étiquettes globales et ${tagStructureTerms.plural}, sans appréciation contextuelle d’un ${realmTerms.inline}.`,
	},
	voteContext: {
		title: "Voter par contexte",
		description: `Choisissez le contexte global ou un ${realmTerms.label} auquel vous pouvez contribuer. La liste, les résultats et vos votes utiliseront ce contexte.`,
		select: "Choisir un contexte de vote",
	},
	details: {
		title: "Autres contextes d’étiquettes",
		description: `Les étiquettes globales et vos sources de ${realmTerms.label} conservent leur propre contexte. Le contexte de vote actif n’est pas répété ici.`,
		empty: "Aucune autre source d’étiquettes n’est sélectionnée.",
	},
	structures: {
		title: tagStructureTerms.pluralLabel,
		description: `Les ${tagStructureTerms.plural} préservent une hiérarchie porteuse de sens et apparaissent avant les étiquettes non hiérarchisées.`,
		addTitle: `Ajouter un ${tagStructureTerms.inline}`,
		addDescription: `Recherchez d’abord les ${tagStructureTerms.plural} acceptés. En ajouter un soutient le chemin et chaque étiquette qui le compose.`,
		add: `Ajouter le ${tagStructureTerms.inline}`,
		create: `Créer un ${tagStructureTerms.inline}`,
		details: `Afficher le ${tagStructureTerms.inline}`,
		empty: `Cette œuvre ne possède encore aucun ${tagStructureTerms.inline} accepté.`,
		memberFallback: "Étiquette sans nom",
		pathLabel: `${tagStructureTerms.label} ordonné`,
	},
	detail: {
		childrenTitle: "Étiquettes enfants directes",
		childrenDescription: `Ces relations proviennent de ${tagStructureTerms.plural} acceptés et verrouillés par la communauté. Chaque enfant affiche ses propres enfants directs.`,
		noChildren: "Cette étiquette ne possède encore aucun enfant direct accepté.",
		grandchildrenTitle: "Enfants directs",
	},
	createStructure: {
		title: `Créer un ${tagStructureTerms.inline}`,
		description:
			"Construisez un chemin ordonné des étiquettes les plus générales aux plus précises. Les membres de la communauté ne peuvent plus le modifier après sa création ; les administrateurs de la plateforme peuvent effectuer des corrections consignées.",
		pick: "Choisir l’étiquette suivante",
		addMember: "Ajouter au chemin",
		removeMember: "Retirer du chemin",
		moveEarlier: "Déplacer vers le début",
		moveLater: "Déplacer vers la fin",
		preview: "Aperçu du chemin verrouillé par la communauté",
		minimum: "Ajoutez au moins deux étiquettes distinctes.",
		submit: `Créer le ${tagStructureTerms.inline} et voter`,
	},
	adminEditStructure: {
		title: `Corriger le ${tagStructureTerms.inline}`,
		description:
			"Les administrateurs de la plateforme peuvent corriger les éléments ou leur ordre. L’identité de la Unit, les votes et les utilisations sont préservés, et la correction est consignée dans l’historique.",
		reasonLabel: "Motif de la correction",
		reasonPlaceholder: "Expliquez pourquoi cette correction administrative est nécessaire.",
		submit: "Enregistrer la correction consignée",
	},
	create: {
		noResults: insert("Aucune étiquette ne correspond à « {{query}} ».", {
			query: String,
		}),
		inStudio: insert(`Créer « {{query}} » dans ${verbatimTerms.studio.value}`, {
			query: String,
		}),
		title: "Créer une étiquette",
		description:
			"Créez une étiquette globale réutilisable après avoir vérifié les étiquettes existantes.",
		voteDescription:
			"Après sa création, vous reviendrez à l’œuvre et voterez « Correspond » dans le contexte actuel.",
		backToUnitTags: "Revenir aux étiquettes de l’œuvre",
		backToStudioTags: `Revenir aux étiquettes dans ${verbatimTerms.studio.value}`,
		submit: "Créer l’étiquette",
		submitAndVote: "Créer l’étiquette et voter « Correspond »",
		applying: "Étiquette créée. Enregistrement de votre vote…",
		partialTitle: "Étiquette créée, vote non enregistré",
		partialDescription:
			"L’étiquette a été créée, mais elle n’a pas pu être appliquée à l’œuvre ou recevoir votre vote. Vous pouvez réessayer sans créer une autre étiquette.",
		retryVote: "Réessayer le vote",
		returnToUnitTags: "Revenir aux étiquettes de l’œuvre",
		completed: "L’étiquette a été créée et votre vote « Correspond » a été enregistré.",
	},
	global: {
		title: "Contexte global",
		description:
			"Dans le contexte global, l’explication d’une étiquette provient de sa propre fiche ; toute personne disposant d’un accès d’interaction peut participer à son évaluation.",
		addTitle: "Ajouter une étiquette globale",
		addDescription:
			"Recherchez d’abord les étiquettes existantes. En ajouter une compte également comme un vote « Correspond ».",
		add: "Ajouter l’étiquette",
		pinned: "Épinglée",
		empty: "Cette œuvre ne possède encore aucune étiquette globale.",
	},
	management: {
		title: "Sélection des étiquettes",
		addSectionTitle: "Ajouter des étiquettes",
		addSectionDescription:
			"Ouvrez la page des étiquettes pour les rechercher et les appliquer. L’ajout et le vote ne nécessitent pas le droit de sélection.",
		addSectionAction: "Ajouter des étiquettes",
		description:
			"Choisissez les étiquettes globales affichées en premier. Les autres conservent le classement de la communauté.",
		featuredTitle: "Étiquettes mises en avant",
		featuredDescription:
			"Les étiquettes mises en avant apparaissent d’abord dans l’ordre défini. Faites-les glisser ou utilisez les boutons.",
		rankedTitle: "Étiquettes classées par la communauté",
		rankedDescription:
			"Les autres étiquettes globales restent automatiquement classées selon les votes de la communauté.",
		feature: "Mettre en avant",
		unfeature: "Retirer de la sélection",
		moveEarlier: "Déplacer vers le haut",
		moveLater: "Déplacer vers le bas",
		drag: insert("Faire glisser {{tag}} pour réorganiser", { tag: String }),
		instructions:
			"Appuyez sur la barre d’espacement pour saisir une étiquette mise en avant. Déplacez-la avec les flèches, puis appuyez de nouveau sur la barre d’espacement pour la déposer.",
		pickedUp: insert("{{tag}} a été saisie.", { tag: String }),
		over: insert("{{tag}} se trouve au-dessus de la position {{position}} sur {{count}}.", {
			tag: String,
			position: Number,
			count: Number,
		}),
		cancelled: insert("Le déplacement de {{tag}} a été annulé.", { tag: String }),
		featuredAnnouncement: insert("{{tag}} a été mise en avant à la position {{position}}.", {
			tag: String,
			position: Number,
		}),
		unfeaturedAnnouncement: insert("{{tag}} a été retirée de la sélection.", {
			tag: String,
		}),
		movedAnnouncement: insert("{{tag}} a été déplacée à la position {{position}}.", {
			tag: String,
			position: Number,
		}),
		noFeatured: "Aucune étiquette mise en avant.",
		noRanked: "Aucune autre étiquette globale ne peut être mise en avant.",
	},
	realms: {
		title: `Contextes d’étiquettes des ${realmTerms.plural}`,
		description: `Chaque ${realmTerms.inline} constitue un contexte indépendant. Ses appréciations ne sont jamais fusionnées avec les étiquettes globales ni avec un autre ${realmTerms.inline}.`,
		addTitle: `Ajouter un vote d’étiquette dans ce ${realmTerms.label}`,
		addDescription: `Recherchez d’abord les étiquettes existantes. En ajouter une vote aussi « Correspond » dans ce ${realmTerms.inline}.`,
		add: "Ajouter le vote",
		policy: `Étiquettes définies par le ${realmTerms.inline}`,
		votes: `Votes des membres du ${realmTerms.inline}`,
		context: "Afficher le contexte de vote",
		empty: "Les sources d’étiquettes sélectionnées n’ont pas encore évalué cette œuvre.",
		cannotVote: `Rejoignez ce ${realmTerms.inline} pour participer à son vote contextuel.`,
	},
	vote: {
		fits: "Correspond",
		doesNotFit: "Ne correspond pas",
		clear: "Retirer mon appréciation",
		signIn: "Se connecter pour voter",
		signInDescription: "Connectez-vous pour voter dans le contexte global des étiquettes.",
		summary: insert("Solde {{score}} · {{count}} votes", {
			score: String,
			count: String,
		}),
	},
	sources: {
		title: "Sources d’étiquettes",
		description: `Choisissez et ordonnez les ${realmTerms.plural} affichés dans les zones d’étiquettes des œuvres. Cela ne vous fait pas ${followTerms.action} une œuvre et ne change pas votre appartenance à un ${realmTerms.inline}.`,
		addTitle: "Ajouter une source d’étiquettes",
		addDescription: `Recherchez parmi les ${realmTerms.plural} lisibles et ajoutez-en un à votre liste personnelle de sources d’étiquettes.`,
		add: "Ajouter la source",
		remove: "Supprimer la source",
		moveEarlier: "Déplacer vers le début",
		moveLater: "Déplacer vers la fin",
		empty: "Aucune source d’étiquettes sélectionnée.",
		manage: "Gérer les sources d’étiquettes",
	},
	unnamedTag: "Étiquette sans nom",
	unnamedRealm: `${realmTerms.label} sans nom`,
	unnamedStructure: `${tagStructureTerms.label} sans nom`,
} satisfies typeof import("../zh-Hant/tags").default;
