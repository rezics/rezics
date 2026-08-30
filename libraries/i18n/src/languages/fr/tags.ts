import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = frTerminology.realm;
const { forms: followTerms } = frTerminology.follow;
const { forms: postTerms } = frTerminology.post;
const { forms: tagPathTerms } = frTerminology.tagPath;

export default {
	page: {
		title: "Étiquettes",
		description:
			"Consultez les étiquettes globales et les appréciations contextuelles formulées par les sources d’étiquettes que vous avez choisies.",
		viewAll: "Afficher la page complète de l’étiquette",
		more: insert("{{count}} de plus", { count: Number }),
		manageOnTagPage: `Ajoutez des étiquettes et des ${tagPathTerms.plural} sur la page dédiée afin que leur contexte de vote reste visible.`,
	},
	card: {
		open: insert("Ouvrir la fiche de l’étiquette {{tag}} ({{context}})", {
			tag: String,
			context: String,
		}),
		close: "Fermer la fiche de l’étiquette",
		globalContext: "Contexte global",
		pathContext: tagPathTerms.label,
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
		description: `Étiquettes globales et ${tagPathTerms.plural}, sans appréciation contextuelle d’un ${realmTerms.inline}.`,
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
	paths: {
		title: tagPathTerms.pluralLabel,
		description: `Les ${tagPathTerms.plural} préservent la structure du vocabulaire ; le sens appliqué provient d’un sens de chemin explicite.`,
		addTitle: `Ajouter un ${tagPathTerms.inline}`,
		addDescription: `Recherchez des sens d’étiquette et de chemin explicites. Appliquer un sens de chemin n’applique pas chaque étiquette du chemin.`,
		add: `Ajouter le ${tagPathTerms.inline}`,
		create: `Créer un ${tagPathTerms.inline}`,
		details: `Afficher le ${tagPathTerms.inline}`,
		empty: `Cette œuvre ne possède encore aucun ${tagPathTerms.inline} accepté.`,
		memberFallback: "Étiquette sans nom",
		pathLabel: `${tagPathTerms.label} ordonné`,
		fitLabel: "Pertinence",
		spoilerLabel: "Niveau de divulgâcheur",
		spoilerNone: "Aucun",
		spoilerMinor: "Mineur",
		spoilerMajor: "Important",
		spoilerSummary: insert("Votes : {{none}} aucun · {{minor}} mineur · {{major}} important", {
			none: Number,
			minor: Number,
			major: Number,
		}),
	},
	expressions: {
		title: "Sens d’étiquette appliqués",
		description:
			"Un même sens relevant d’une même autorité est regroupé, tandis que chaque source directe ou issue d’un chemin reste consultable.",
		empty: "Aucun sens d’étiquette n’est encore appliqué.",
		partial: "Cette carte contient d’autres sens d’étiquette.",
		open: insert("Ouvrir la fiche du sens {{expression}} ({{authority}})", {
			expression: String,
			authority: String,
		}),
		close: "Fermer la fiche du sens d’étiquette",
		applicationsTitle: "Applications à ce contenu",
		applicationCount: insert("{{count}} sources d’application", { count: Number }),
		directApplication: "Application directe",
		pathApplication: "Application d’un sens de chemin",
		sourceDate: insert("Créée le {{date}}", { date: String }),
		sourceContributor: "Voir la personne contributrice",
		removeApplication: "Retirer cette application de chemin",
		showCompletePath: "Afficher le chemin complet",
		otherPositionsTitle: "Autres positions de cette étiquette",
		otherPositionsDescription:
			"Ces positions appartiennent à la structure du vocabulaire, mais ne sont pas appliquées à ce contenu.",
		authoritySection: insert("Sens d’étiquette de {{authority}}", { authority: String }),
		relationFallback: "Relation",
		relations: {
			generic: "Type",
			partitive: "Partie",
			instance: "Instance",
			organizational: "Organisation",
			facet_value: "Valeur de facette",
		},
	},
	searchMatches: {
		matched: "Correspondance :",
		why: "Pourquoi ce résultat correspond",
		evidence: {
			direct: "Application directe du tag",
			primary: "Sens de tag appliqué",
			entailed: "Inférence sémantique",
			retrieval_only: "Extension de recherche",
		},
		otherPositions: insert("{{count}} autres positions dans le vocabulaire", { count: Number }),
	},
	semantics: {
		structureTitle: "Structure du vocabulaire",
		structureDescription:
			"Ce chemin ne consigne qu’une position dans le vocabulaire et des relations typées. Il n’attribue pas automatiquement chaque membre au contenu.",
		sensesTitle: "Sens du chemin",
		sensesDescription:
			"Chaque sens lie les membres du chemin à une expression de tag complète qui peut être appliquée au contenu.",
		noSenses: "Ce chemin n’a pas encore de sens applicable.",
		expressionKind: "Type d’expression",
		expressionKinds: {
			simple: "Concept unique",
			facet_value: "Facette et valeur",
			relation: "Relation et objet",
		},
		focus: "Concept principal",
		value: "Valeur",
		slot: "Facette",
		predicate: "Relation",
		scope: "Portée",
		globalScope: "Globale",
		realmScope: realmTerms.label,
		status: "État",
		statuses: { active: "Actif", retired: "Retiré" },
		labelSignature: "Composants du libellé autonome",
		bindingsTitle: "Liens entre membres et rôles",
		roles: {
			predicate: "Relation",
			slot: "Facette",
			value: "Valeur",
			focus: "Principal",
			qualifier: "Qualificatif",
		},
		inferenceRulesTitle: "Règles d’inférence explicites",
		noInferenceRules: "Cette expression n’a aucune règle d’inférence supplémentaire.",
		inferenceKind: "Type de règle",
		inferenceKinds: { entailed: "Implication sémantique", retrieval_only: "Recherche uniquement" },
		inferenceTarget: "Cible de la règle",
		targetTag: "Tag cible",
		targetExpression: "Expression cible",
		ruleRevision: insert("Révision {{revision}}", { revision: Number }),
		provenance: "Trace de provenance",
		curationTitle: "Curation sémantique",
		curationDescription:
			"Créez des liens sémantiques immuables et n’ajoutez des inférences qu’au moyen de règles explicites et gouvernées.",
		createSense: "Créer un sens de chemin",
		createSenseAction: "Créer le sens",
		sense: "Sens source",
		addInference: "Ajouter une règle d’inférence",
		expressionId: `${verbatimTerms.id.value} d’expression`,
		expressionIdPlaceholder: `Saisissez l’${verbatimTerms.id.value} immuable de l’expression cible`,
		addInferenceAction: "Ajouter la règle",
		lifecycleTitle: "Retirer des définitions",
		lifecycleDescription:
			"Le retrait conserve l’historique des applications existantes. Un sens retiré ne peut plus être appliqué ; une règle retirée ne contribue plus aux résultats d’inférence reconstruits.",
		retireSenseAction: "Retirer le sens",
		retireSenseConfirm:
			"Retirer ce sens ? Les applications existantes conservent leur historique, mais aucune nouvelle application ne pourra l’utiliser.",
		retireInferenceAction: "Retirer la règle",
		retireInferenceConfirm:
			"Retirer cette règle ? Elle ne contribuera plus aux résultats d’inférence et de recherche reconstruits.",
		directMeaningTitle: "Sens direct du tag",
		directMeaningDescription:
			"Les applications directes de ce tag utilisent cette expression à concept unique.",
		qualifiedTitle: "Expressions qualifiées",
		qualifiedDescription:
			"Ces expressions utilisent ce concept comme valeur de facette, relation ou qualificatif.",
		noQualified: "Aucune expression qualifiée n’utilise encore ce concept.",
		positionsTitle: "Toutes les positions dans le vocabulaire",
		positionsDescription:
			"Il s’agit des positions du concept dans la structure globale du vocabulaire ; elles n’indiquent pas qu’un contenu les a adoptées.",
		noPositions: "Ce concept n’apparaît encore dans aucun chemin accepté.",
		inferredReachTitle: "Portée inférée",
		inferredReachDescription:
			"Ces expressions atteignent le concept par une règle explicite d’implication ou d’extension de recherche.",
		noInferredReach: "Aucune expression n’infère ou n’étend actuellement vers ce concept.",
		directUsagesTitle: "Applications directes",
		directUsagesDescription:
			"Seuls les contenus auxquels ce concept unique est directement appliqué apparaissent ici.",
		semanticReachTitle: "Portée sémantique et de recherche",
		semanticReachDescription:
			"Les contenus liés par une expression principale, une implication sémantique ou une extension de recherche apparaissent ici.",
	},
	detail: {
		sections: "Onglets des détails du tag",
		tabs: {
			overview: "Vue d’ensemble",
			discussion: "Discussion",
			content: "Contenu associé",
			paths: "Hiérarchie",
		},
		overviewTitle: "Description du tag",
		overviewDescription:
			"Consultez l’explication complète de ce tag. Son résumé reste affiché dans les cartes et les aperçus.",
		bodyEmpty: "Ce tag n’a pas encore de description détaillée.",
		discussionTitle: "Discussion",
		discussionDescription: `Créez des ${postTerms.plural} sur ce tag et participez aux discussions existantes.`,
		contentTitle: "Contenu associé",
		contentDescription: "Parcourez les œuvres et autres contenus qui utilisent ce tag.",
		pathsTitle: "Hiérarchie du tag",
		pathsDescription: "Repérez ce tag dans les structures de tags approuvées par la communauté.",
		editTitle: "Modifier le contenu du tag",
		editDescription:
			"Mettez à jour le titre, le résumé et la description dans la langue de contenu actuelle.",
		editNavigation: "Gestion du contenu du tag",
		backToTag: "Retour au tag",
		backToEditOverview: "Retour à la vue d’ensemble de l’édition",
		childrenTitle: "Étiquettes enfants directes",
		childrenDescription: `Ces relations proviennent de ${tagPathTerms.plural} acceptés et verrouillés par la communauté. Chaque enfant affiche ses propres enfants directs.`,
		noChildren: "Cette étiquette ne possède encore aucun enfant direct accepté.",
		grandchildrenTitle: "Enfants directs",
	},
	createPath: {
		title: `Créer un ${tagPathTerms.inline}`,
		description:
			"Construisez un chemin ordonné des étiquettes les plus générales aux plus précises. Une définition ne peut plus être modifiée après sa création ; créez un nouveau chemin et soumettez une proposition de gouvernance manuelle.",
		pick: "Choisir l’étiquette suivante",
		addMember: "Ajouter au chemin",
		removeMember: "Retirer du chemin",
		moveEarlier: "Déplacer vers le début",
		moveLater: "Déplacer vers la fin",
		preview: "Aperçu du chemin verrouillé par la communauté",
		relationKind: "Relation avec le nœud précédent",
		minimum: "Ajoutez au moins deux étiquettes distinctes.",
		submit: `Créer le ${tagPathTerms.inline} et voter`,
		relatedTitle: "Examiner les chemins acceptés associés",
		relatedDescription:
			"Ces chemins aboutissent déjà à la même étiquette. Ils ne sont pas automatiquement des doublons ; vérifiez leur sens avant de créer une définition immuable distincte.",
		continueDistinct: "Créer un chemin distinct",
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
		pathsTitle: `${tagPathTerms.pluralLabel} du ${realmTerms.label}`,
		applyPath: "Appliquer le chemin",
		authority: { realm: `Ce ${realmTerms.label}`, global: "Global" },
		pathAuthority: insert("Adéquation : {{fit}} · divulgâcheurs : {{spoiler}}", {
			fit: String,
			spoiler: String,
		}),
		title: `Contextes d’étiquettes des ${realmTerms.plural}`,
		description: `Chaque ${realmTerms.inline} constitue un contexte indépendant. Ses appréciations ne sont jamais fusionnées avec les étiquettes globales ni avec un autre ${realmTerms.inline}.`,
		addTitle: `Ajouter un vote d’étiquette dans ce ${realmTerms.label}`,
		addDescription: `Recherchez d’abord les étiquettes existantes. En ajouter une vote aussi « Correspond » dans ce ${realmTerms.inline}.`,
		add: "Ajouter le vote",
		policy: `Étiquettes définies par le ${realmTerms.inline}`,
		votes: `Votes des membres du ${realmTerms.inline}`,
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
	unnamedPath: `${tagPathTerms.label} sans nom`,
} satisfies typeof import("../zh-Hant/tags").default;
