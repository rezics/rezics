import { insert } from "native-i18n";

import { frTerminology } from "@rezics/i18n/terminology/fr";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = frTerminology.realm;
const { forms: postTerms } = frTerminology.post;

export default {
	title: "Console de gestion",
	description:
		"Les capacités de la plateforme donnent accès à chaque zone de gestion ; elles ne représentent ni une identité d’utilisateur ni une relation de travail.",
	backToApplication: "Retour à l’application",
	navigation: "Navigation de la console de gestion",
	overview: "Toutes les zones de gestion",
	cancel: "Annuler",
	sections: {
		access: {
			label: "Accès à la plateforme",
			description:
				"Consultez ou gérez les capacités de plateforme accordées aux profils, y compris l’expiration et l’origine de chaque attribution.",
		},
		moderation: {
			label: "Gouvernance globale des contenus",
			description:
				"Traitez les signalements fondés sur les règles globales et gérez l’état des unités sur la plateforme.",
		},
		audit: {
			label: "Audit de sécurité",
			description: `Consultez les événements administratifs importants et les décisions de sécurité pour la plateforme, les ${realmTerms.plural} et les Units.`,
		},
	},
	access: {
		searchTitle: "Rechercher un profil",
		searchLabel: "Nom ou adresse e-mail de connexion",
		searchPlaceholder: "Saisissez un nom ou une adresse e-mail",
		search: "Rechercher",
		searchResults: "Résultats de recherche",
		activeProfiles: "Profils disposant d’un accès actif à la plateforme",
		noProfiles: "Aucune capacité de plateforme n’est actuellement attribuée.",
		noSearchResults: "Aucun profil correspondant n’a été trouvé.",
		selectProfile: "Sélectionnez un profil pour consulter son accès à la plateforme.",
		capabilityCount: insert("{{count}} capacités", { count: Number }),
		capability: "Capacité",
		expiry: "Expiration",
		expiryFor: insert("Expiration de {{capability}}", { capability: String }),
		noExpiry: "Sans expiration",
		provenance: "Origine de l’attribution",
		grantProvenance: insert("Attribuée par {{profileId}} le {{date}}", {
			profileId: String,
			date: String,
		}),
		notGranted: "Non attribuée directement",
		readOnly: "Vous pouvez consulter l’accès à la plateforme, mais pas le modifier.",
		grantAll: "Accorder toutes les capacités",
		clearAll: "Retirer toutes les capacités",
		save: "Enregistrer l’accès à la plateforme",
		revokeAllTitle: "Révoquer tous les accès à la plateforme de ce profil ?",
		revokeAllDescription:
			"Cette action révoque toutes les attributions actives. Le serveur refuse la modification si elle retire le dernier gestionnaire d’accès à la plateforme sans date d’expiration.",
		confirmRevokeAll: "Confirmer la révocation complète",
	},
	moderation: {
		filterState: "État du dossier",
		allStates: "Tous les états",
		queue: "Dossiers de signalement globaux",
		empty: "Aucun dossier de signalement global ne correspond au filtre actuel.",
		untitled: "Unité sans titre",
		reports: "Signalements de ce dossier",
		action: "Action de gouvernance",
		reason: "Motif de gouvernance",
		internalNote: "Note interne (facultatif)",
		notePlaceholder: "Consignez la justification ; obligatoire pour ajouter une note.",
		submit: "Appliquer l’action",
		succeeded: "Action de gouvernance globale terminée",
		confirmRemovalTitle: "Retirer ce contenu de la plateforme ?",
		confirmRemovalDescription: insert(
			"{{title}} sera marqué comme retiré à l’échelle de la plateforme.",
			{ title: String },
		),
		confirmRemoval: "Retirer le contenu",
		reportCount: insert("{{count}} signalements", { count: Number }),
		moderationStatuses: {
			approved: "Approuvé",
			pending: "En attente d’examen",
			removed: "Retiré",
		},
		targetingLocked: `Nouvelles références de ${postTerms.plural} bloquées`,
		targetingUnlocked: `Nouvelles références de ${postTerms.plural} autorisées`,
		openContent: "Ouvrir le contenu",
	},
	audit: {
		category: "Catégorie d’événement",
		allCategories: "Toutes les catégories",
		categories: {
			admin_activity: "Activité administrative",
			policy_denied: "Refus par une règle",
			system_event: "Événement système",
		},
		outcome: "Résultat",
		allOutcomes: "Tous les résultats",
		outcomes: {
			succeeded: "Réussi",
			denied: "Refusé",
			failed: "Échec",
		},
		time: "Date et heure",
		action: "Action",
		actor: "Auteur",
		authority: "Autorité",
		authorities: {
			platform: "Plateforme",
			realm: realmTerms.label,
			unit: "Unit",
		},
		empty: "Aucun événement d’audit ne correspond aux filtres actuels.",
		previousPage: "Page précédente",
		nextPage: "Page suivante",
		selectEvent: "Sélectionnez un événement pour consulter son enregistrement d’audit complet.",
		detailsTitle: "Détails de l’événement",
		systemActor: "Système",
		credential: "Type d’identifiant",
		credentialId: `${verbatimTerms.id.value} de l’identifiant`,
		credentials: {
			session: "Session interactive",
			api_token: "Jeton " + verbatimTerms.api.value,
			bootstrap: "Initialisation du système",
			system: "Processus système",
		},
		scopedAuthority: insert("{{kind}} ({{id}})", { kind: String, id: String }),
		target: "Cible",
		noTarget: "Aucune cible précise",
		reasonCode: "Code de motif",
		requestId: `${verbatimTerms.id.value} de la requête`,
		traceId: `${verbatimTerms.id.value} de trace`,
		rawDetails: "Détails structurés",
	},
} satisfies typeof import("../zh-Hant/console").default;
