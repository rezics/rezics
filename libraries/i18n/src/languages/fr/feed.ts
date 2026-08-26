import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: followTerms } = frTerminology.follow;
const { forms: postTerms } = frTerminology.post;
const { forms: realmTerms } = frTerminology.realm;
const { forms: entityTerms } = frTerminology.entity;
const { forms: tagPathTerms } = frTerminology.tagPath;
const { forms: zoneTerms } = frTerminology.zone;
const { forms: videoTerms } = frTerminology.video;
const { forms: audioTerms } = frTerminology.audio;

export default {
	title: "Fil",
	subtitle: "Les œuvres gagnent en visibilité grâce aux échanges",
	personalized: "Pour vous",
	sortLabel: "Tri du fil",
	sort: { best: "Meilleur", new: "Nouveau" },
	filtersLabel: "Filtres du fil",
	filters: {
		title: "Filtres",
		clear: "Effacer les filtres",
		cancel: "Annuler",
		apply: "Appliquer les filtres",
		selectedCount: insert("{{count}} sélectionnés", { count: Number }),
		languages: {
			label: "Langues",
			all: "Toutes les langues",
			options: { zh: "Chinois", en: "Anglais" },
		},
		realms: {
			label: realmTerms.label,
			all: `Tous les ${realmTerms.plural}`,
			unnamed: `${realmTerms.label} sans nom`,
		},
		tags: {
			label: "Étiquettes",
			all: "Toutes les étiquettes",
			unnamed: "Étiquette sans nom",
		},
	},
	contentFilterLabel: "Filtre de contenu",
	pagination: {
		label: "Chargement du contenu suivant",
		modes: {
			"load-more": "Afficher le bouton « Charger plus »",
			infinite: "Charger automatiquement pendant le défilement",
		},
	},
	content: {
		clear: "Tout effacer",
		allSelected: "Tout le contenu",
		selectedCount: insert("{{count}} sélectionnés", { count: Number }),
		unitGroup: "Units",
		postGroup: postTerms.pluralLabel,
		kinds: {
			"unit:profile": "Profils",
			"unit:book": "Livres",
			"unit:software": "Logiciels",
			"unit:media": "Médias",
			"unit:video": videoTerms.pluralLabel,
			"unit:audio": audioTerms.label,
			"unit:release": "Versions",
			"unit:entity": entityTerms.pluralLabel,
			"unit:tag": "Étiquettes",
			"unit:structure": tagPathTerms.pluralLabel,
			"unit:series": "Séries",
			"unit:zone": zoneTerms.pluralLabel,
			"unit:collection": "Collections",
			"unit:poll": "Sondages",
			"unit:realm": realmTerms.pluralLabel,
			"post:post": postTerms.pluralLabel,
			"post:reply": "Réponses",
			"post:excerpt": "Extraits",
			"post:review": "Avis",
			"post:chapter": "Chapitres",
			"post:wiki": "Articles de wiki",
			"post:picture": `${postTerms.pluralLabel} illustrées`,
		},
		postDescription: "Discussions lancées par des membres de la communauté",
		replyDescription: "Réponses au sein des discussions en cours",
	},
	discoverWorks: "Découvrez des œuvres qui méritent votre temps",
	emptyTitle: "Tout est calme ici",
	emptyBody: "Soyez la première personne à partager une œuvre ou une idée.",
	reason: {
		followedUnit: `Parce que vous avez choisi de ${followTerms.action} cet élément ou une personne qui y est créditée`,
		followedRealm: `Parce que vous avez choisi de ${followTerms.action} le ${realmTerms.inline}`,
		basedOnActivity: "D’après votre activité récente",
		relatedSubject: "En rapport avec ce que vous consultez",
		popularNow: "Populaire en ce moment",
		newAndRelevant: "Nouveau et potentiellement pertinent",
	},
	recommendationMenu: "Options de recommandation",
	moreActions: "Plus d’actions",
	notInterested: "Cela ne m’intéresse pas",
	actions: {
		voteGroup: "Évaluation du contenu",
		comments: insert("{{count}} réponses", { count: Number }),
		shareTitle: "Partager le contenu",
		shareDescription: "Utilisez le menu de partage de votre appareil ou copiez le lien du contenu.",
		shareNative: "Partager dans une autre application",
		copyLink: "Copier le lien",
		linkCopied: "Lien copié",
		shareFailed: "Impossible de partager. Réessayez plus tard.",
		saved: "Enregistré",
		addToCollection: "Ajouter à une collection",
		collectionPickerTitle: "Ajouter à une collection",
		collectionPickerDescription: "Choisissez une collection pour ce contenu.",
		collectionAdded: "Ajouté à la collection",
		noOwnedCollections: "Vous n’avez pas encore de collection disponible.",
		manageCollections: "Gérer les collections",
	},
	replyingIn: "Réponse dans",
	relatedPosts: "Discussions associées",
	relatedWorks: "Œuvres similaires",
	activeRealms: `${realmTerms.pluralLabel} actifs`,
	continueReading: "Continuer la lecture",
	viewAll: "Tout afficher",
	relatedWork: "Œuvre associée",
	realmTagContext: `Explication de Tag du ${realmTerms.label}`,
	excerptSource: "Source de l’extrait",
	excerptSourceMark: "―",
	myRealms: `Mes ${realmTerms.pluralLabel}`,
	contextSeparator: "dans",
	attributionList: insert("{{count}} contributeurs crédités", { count: Number }),
	realmList: insert(`{{count}} ${realmTerms.plural}`, { count: Number }),
	showAttributionList: insert("{{attribution}} et {{count}} autres ; afficher les crédits", {
		attribution: String,
		count: Number,
	}),
	showRealmList: insert(
		`{{realm}} et {{count}} autres ; afficher la liste des ${realmTerms.plural}`,
		{
			realm: String,
			count: Number,
		},
	),
	targetScore: insert("{{score}}/10 · {{count}} évaluations", {
		score: String,
		count: Number,
	}),
	noRatings: "Aucune évaluation pour le moment",
	collectionDirectItems: insert("{{count}} éléments directs", { count: Number }),
} satisfies typeof import("../zh-Hant/feed").default;
