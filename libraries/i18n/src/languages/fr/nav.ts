import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: followTerms } = frTerminology.follow;
const { forms: labelTerms } = frTerminology.label;
const { forms: postTerms } = frTerminology.post;
const { forms: videoTerms } = frTerminology.video;
const { forms: audioTerms } = frTerminology.audio;
const { forms: realmTerms } = frTerminology.realm;
const { forms: entityTerms } = frTerminology.entity;
const { forms: unitSlugTerms } = frTerminology.unitSlug;
const { forms: zoneTerms } = frTerminology.zone;

export default {
	home: "Accueil",
	studio: verbatimTerms.studio.value,
	units: "Units",
	entity: entityTerms.label,
	realm: realmTerms.label,
	collections: "Collections",
	favorites: "Enregistrés",
	progress: "Progression",
	me: "Moi",
	skipToContent: "Accéder au contenu principal",
	navigation: "Navigation",
	content: "Contenu",
	userMenu: {
		label: "Menu utilisateur",
		description:
			"Consultez votre profil, adaptez vos préférences et réglages, ou déconnectez-vous.",
		back: "Retour au menu utilisateur",
		close: "Fermer le menu utilisateur",
		viewProfile: "Afficher le profil",
		myContent: "Mon contenu",
		myReports: "Mes signalements",
		settings: "Réglages",
		console: "Console de gestion",
		invitations: "Invitations d’accès reçues",
		signOut: "Se déconnecter",
	},
	sidebar: {
		title: "Navigation principale",
		description: `Accédez à l’accueil, à vos destinations habituelles ainsi qu’aux ${zoneTerms.plural} et ${realmTerms.plural} que vous suivez.`,
		open: "Ouvrir la navigation principale",
		close: "Fermer la navigation principale",
		expand: "Déployer la barre latérale",
		collapse: "Replier la barre latérale",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `Tous les ${zoneTerms.plural}`,
		allRealms: `Tous les ${realmTerms.plural}`,
		zonesEmpty: `Les ${zoneTerms.plural} que vous suivez apparaîtront ici.`,
		realmsEmpty: `Les ${realmTerms.plural} que vous suivez apparaîtront ici.`,
		loading: "Chargement du contenu de la barre latérale.",
		error: "Impossible de charger le contenu de la barre latérale.",
	},
	following: {
		title: followTerms.collectionLabel,
		all: "Tous les éléments suivis",
		empty: "Les Units que vous suivez apparaîtront ici.",
		description: "Filtrez, épinglez et organisez les Units que vous suivez.",
		filter: "Filtrer les types de Units suivies",
		favorite: "Épingler",
		unfavorite: "Désépingler",
		types: {
			slug_namespace: `Périmètre de nommage d’${unitSlugTerms.inline}`,
			profile: "Profil",
			book: "Livre",
			software: "Logiciel",
			media: "Média",
			video: videoTerms.label,
			audio: audioTerms.label,
			release: "Version",
			entity: entityTerms.label,
			label: labelTerms.label,
			tag: "Étiquette",
			series: "Série",
			zone: zoneTerms.label,
			zone_theme: `Thème de ${zoneTerms.inline}`,
			zone_page: `Page d’${zoneTerms.inline}`,
			collection: "Collection",
			post: postTerms.label,
			poll: "Sondage",
			realm: realmTerms.label,
			realm_rule: `Règle de ${realmTerms.inline}`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
