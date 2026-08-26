import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: realmTerms } = frTerminology.realm;
const { forms: unitSlugTerms } = frTerminology.unitSlug;
const { forms: licenseTerms } = frTerminology.license;
const { forms: metadataTerms } = frTerminology.metadata;
const { forms: postTerms } = frTerminology.post;

export default {
	workspace: {
		title: "Réglages",
		description: `Gérez votre profil, vos préférences, vos sources d’étiquettes, la sécurité de votre compte et vos jetons ${verbatimTerms.api.value}.`,
		backToApplication: "Retour à l’application",
		backToOverview: "Retour aux réglages",
		navigation: "Navigation des réglages",
		overview: "Tous les réglages",
		sections: {
			profile: {
				label: "Profil",
				description:
					"Mettez à jour votre nom public, votre présentation, votre photo, votre bannière et l’adresse de votre profil.",
			},
			preferences: {
				label: "Préférences",
				description: `Choisissez les langues de l’interface et du contenu, les classifications, un ${realmTerms.inline} de notation par défaut et une ${frTerminology.license.forms.inline} par défaut.`,
			},
			privacy: {
				label: "Confidentialité",
				description: "Contrôlez si les autres peuvent voir vos notes et votre progression.",
			},
			tagSources: {
				label: "Sources d’étiquettes",
				description: `Choisissez et ordonnez les ${realmTerms.plural} dont vous souhaitez voir les appréciations d’étiquettes.`,
			},
			account: {
				label: "Compte",
				description: "Consultez les informations du compte et gérez votre connexion actuelle.",
			},
			security: {
				label: "Sécurité",
				description: "Changez votre mot de passe et gérez les appareils connectés.",
			},
			tokens: {
				label: `Jetons ${verbatimTerms.api.value}`,
				description:
					"Créez, limitez, désactivez et révoquez des jetons d’accès pour les outils d’automatisation.",
			},
		},
	},
	privacy: {
		title: "Confidentialité",
		description:
			"Définissez la limite globale de visibilité des notes et de la progression actuelle.",
		scoreTitle: "Notes",
		scoreDescription:
			"Limite l’affichage de vos notes aux autres personnes sur votre profil ou dans les critiques associées.",
		progressTitle: "Progression",
		progressDescription:
			"Limite l’affichage de votre progression actuelle aux autres personnes sur votre profil ou dans les critiques associées.",
		categoryRule:
			"Ce réglage global est une limite de visibilité et ne modifie pas les éléments individuels. Le mode privé masque temporairement les éléments publics ; ils réapparaissent lorsque vous rétablissez le mode public.",
		unlistedRule: `Les éléments non répertoriés restent absents de votre profil, mais peuvent apparaître dans une critique ou une ${postTerms.inline} que vous liez explicitement. Les éléments privés ne sont visibles que par vous.`,
	},
	profile: "Profil",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `Utilisez entre 1 et 63 lettres ${verbatimTerms.ascii.value} minuscules, chiffres ou traits d’union. Après une modification, l’ancienne ${verbatimTerms.url.value} redirige définitivement vers la nouvelle ${verbatimTerms.url.value}.`,
	profileSlugAddressHint: `Choisissez avec soin : cette adresse ne peut actuellement être définie qu’une seule fois et ne peut plus être modifiée ensuite. Utilisez entre 1 et 63 lettres ${verbatimTerms.ascii.value} minuscules, chiffres ou traits d’union. Les noms réservés par la plateforme ne sont pas disponibles.`,
	profileSlugAddressAssignedHint:
		"Cette adresse de profil a été définie et ne peut actuellement plus être modifiée.",
	profileSlugReserved: "Cette adresse de profil est réservée et ne peut pas être utilisée.",
	preferences: "Préférences",
	interfaceLanguage: "Langue de l’interface",
	contentLanguage: "Langue de contenu préférée",
	contentLanguages: "Langues de contenu préférées",
	contentLanguagesHint:
		"Faites glisser les langues pour les réordonner. Le contenu utilise cet ordre, puis la langue de l’interface, avant de revenir à l’ordre des langues propre à la Unit.",
	addContentLanguage: "Ajouter une langue",
	dragContentLanguage: insert("Faire glisser {{language}} pour la réordonner", {
		language: String,
	}),
	moveContentLanguageUp: insert("Déplacer {{language}} vers le haut", { language: String }),
	moveContentLanguageDown: insert("Déplacer {{language}} vers le bas", { language: String }),
	removeContentLanguage: insert("Retirer {{language}}", { language: String }),
	filterFeedByPreferredLanguages: "Filtrer le fil selon les langues préférées",
	filterFeedByPreferredLanguagesHint:
		"Lorsque cette option est activée, le fil comprend uniquement du contenu disponible dans au moins une langue préférée. Les autres listes continuent d’afficher tout le contenu correspondant avec une langue de remplacement.",
	alwaysShowSpoilers: "Toujours afficher les divulgâcheurs",
	alwaysShowSpoilersHint: "Afficher directement le contenu signalé comme divulgâcheur.",
	alwaysShowNsfw: "Toujours afficher les médias sensibles",
	alwaysShowNsfwHint: "Afficher les médias signalés comme sensibles sans les flouter au préalable.",
	account: "Compte",
	accountDescription: "Gérez la session actuellement connectée.",
	security: "Sécurité",
	securityDescription:
		"Changez le mot de passe de votre compte. Vous pouvez également déconnecter vos autres appareils.",
	currentPassword: "Mot de passe actuel",
	newPassword: "Nouveau mot de passe",
	revokeOtherSessions: "Déconnecter les autres appareils après le changement de mot de passe",
	passwordChanged: "Votre mot de passe a été modifié.",
	sessions: "Appareils connectés",
	sessionsDescription:
		"Révoquez les sessions que vous n’utilisez plus ou que vous ne reconnaissez pas.",
	currentSession: "Appareil actuel",
	unknownDevice: "Appareil inconnu",
	unknownAddress: "Adresse inconnue",
	lastUpdated: "Activité récente",
	sessionExpires: "Expire",
	revokeSession: "Déconnecter cet appareil",
	tokens: {
		title: `Jetons ${verbatimTerms.api.value}`,
		description:
			"Créez des identifiants d’automatisation avec le minimum d’accès nécessaire et des limites propres à chaque jeton.",
		securityWarningTitle: `Protégez vos jetons ${verbatimTerms.api.value}`,
		securityWarning:
			"Traitez les jetons comme des mots de passe : ne les partagez pas et ne les enregistrez pas dans le gestionnaire de versions. Accordez uniquement les autorisations nécessaires et définissez une expiration appropriée. Si un jeton a pu être exposé, révoquez-le et remplacez-le immédiatement.",
		securityGuide: "Consulter le guide d’utilisation",
		createTitle: "Créer un jeton",
		createDescription:
			"Le secret n’est affiché qu’une seule fois. Commencez par choisir le minimum d’accès nécessaire et des limites prudentes.",
		name: "Nom",
		namePlaceholder: `Par exemple : agent de complétion des ${metadataTerms.inline} de livres`,
		expiresIn: "Durée de validité",
		expiryDays: {
			thirty: "30 jours",
			ninety: "90 jours",
			year: "365 jours",
		},
		permissions: "Autorisations",
		permissionsDescription:
			"Accordez uniquement les opérations nécessaires à la tâche. Sélectionnez-en au moins une.",
		selectContentAgent: "Sélectionner les réglages par défaut de l’agent de contenu",
		selectReadOnly: "Sélectionner les réglages par défaut en lecture seule",
		permissionsRequired: "Sélectionnez au moins une autorisation.",
		matrix: {
			templates: "Modèles d’autorisations",
			searchPlaceholder: "Rechercher des groupes d’autorisations…",
			clear: "Tout désélectionner",
			selected: insert("{{selected}} / {{total}} sélectionnées", {
				selected: Number,
				total: Number,
			}),
			categorySelected: insert("{{selected}} sélectionnées", { selected: Number }),
			required: "Obligatoire",
			empty: "Aucune autorisation ne correspond à la recherche.",
		},
		permissionCategories: {
			content: "Contenu et collaboration",
			identity: "Identité et profil",
			communication: "Communication",
			platform: "Plateforme",
		},
		permissionResources: {
			unit: "Units",
			profile: "Profil",
			interaction: "Interactions",
			realm: realmTerms.label,
			message: "Messages",
			notification: "Notifications",
			recommendation: "Recommandations",
			upload: "Importations",
			report: "Signalements",
		},
		permissionActions: {
			read: "Lire",
			create: "Créer",
			update: "Mettre à jour",
			write: "Écrire",
			manage: "Gérer",
		},
		permissionLabels: {
			unitRead: "Lire les Units et leur contenu",
			unitCreate: "Créer des Units",
			unitUpdate: "Mettre à jour les Units et leurs traductions",
			profileRead: "Lire les profils publics",
			profileUpdate: "Mettre à jour le profil",
			interactionRead: "Lire les interactions",
			interactionWrite: "Créer des interactions",
			realmRead: `Lire les ${realmTerms.plural}`,
			realmManage: `Gérer les ${realmTerms.plural}`,
			messageRead: "Lire les messages",
			messageWrite: "Envoyer des messages",
			notificationRead: "Lire les notifications",
			notificationWrite: "Mettre à jour l’état des notifications",
			recommendationRead: "Lire les recommandations",
			recommendationWrite: "Envoyer des interactions de recommandation",
			uploadRead: "Lire les importations",
			uploadWrite: "Créer des importations",
			reportWrite: "Envoyer des signalements",
		},
		limits: "Limites d’utilisation",
		standardLimitsDescription: `Chaque jeton possède sa propre politique de plateforme et partage aussi le quota du compte. Votre protection facultative ne peut que réduire sa capacité ; l’accès ${verbatimTerms.privilegedApiQuotaClass.value} exige une autorité de plateforme.`,
		limitsDescription:
			"Les quotas doivent rester dans les plages autorisées par la règle actuelle. Les limites globales et propres à une opération s’appliquent conjointement.",
		limitRanges: insert(
			"Plages autorisées : {{requestsMinimum}} à {{requestsMaximum}} requêtes par minute ; capacité de pointe de {{burstMinimum}} à {{burstMaximum}} ; {{concurrentMinimum}} à {{concurrentMaximum}} requêtes simultanées ; {{dailyMinimum}} à {{dailyMaximum}} unités de coût quotidiennes.",
			{
				requestsMinimum: String,
				requestsMaximum: String,
				burstMinimum: String,
				burstMaximum: String,
				concurrentMinimum: String,
				concurrentMaximum: String,
				dailyMinimum: String,
				dailyMaximum: String,
			},
		),
		limitRangePlaceholder: insert("Plage : {{minimum}}–{{maximum}}", {
			minimum: String,
			maximum: String,
		}),
		limitRangeError: insert(
			"Saisissez un nombre entier compris entre {{minimum}} et {{maximum}}.",
			{
				minimum: String,
				maximum: String,
			},
		),
		requestsPerMinute: "Requêtes par minute",
		burstCapacity: "Capacité de pointe",
		maxConcurrentRequests: "Requêtes simultanées",
		dailyCostUnits: "Unités de coût quotidiennes",
		create: "Créer le jeton",
		createdTitle: "Enregistrez le nouveau jeton maintenant",
		createdDescription:
			"Vous ne pourrez plus l’afficher après avoir fermé cet avis. Révoquez et remplacez tout jeton perdu.",
		copyToken: "Copier le jeton",
		dismissSecret: "Je l’ai conservé en lieu sûr",
		listTitle: "Jetons existants",
		listDescription:
			"Contrôlez régulièrement leur utilisation et révoquez les jetons dès qu’ils ne sont plus nécessaires.",
		empty: `Aucun jeton ${verbatimTerms.api.value} n’a encore été créé.`,
		enabled: "Activé",
		disabled: "Désactivé",
		prefix: "Préfixe d’identification",
		expires: "Expire",
		lastUsed: "Dernière utilisation",
		neverUsed: "Jamais utilisé",
		policy: "Règle",
		standardPolicy: "Standard",
		privilegedPolicy: verbatimTerms.privilegedApiQuotaClass.value,
		trustedFallback: "Repli Standard actif",
		trustedUntil: "L’accès à débit supérieur expire",
		manageAccess: "Gérer le nom et l’accès",
		configureLimits: "Configurer les limites",
		hideEditor: "Fermer les réglages",
		saveAccess: "Enregistrer le nom et l’accès",
		enable: "Activer",
		disable: "Désactiver",
		revoke: "Révoquer",
		revokeTitle: "Révoquer définitivement ce jeton ?",
		revokeDescription:
			"Toutes les automatisations qui utilisent ce jeton perdront immédiatement leur accès. Cette action est irréversible.",
		cancel: "Annuler",
		saveLimits: "Enregistrer les limites",
		operationOverrides: "Limites propres à une opération",
		operationOverridesDescription: `Utilisez l’${verbatimTerms.apiPolicyOperationId.value} du document ${verbatimTerms.openapi.value} pour définir une limite dédiée à une opération. Les limites globales restent applicables.`,
		operationId: `${verbatimTerms.id.value} d’opération`,
		operationIdPlaceholder: `Collez un ${verbatimTerms.id.value} d’opération`,
		operations: {
			"search.execute": "Exécuter une recherche",
			"image.upload": "Téléverser des images",
		},
		addOperation: "Ajouter une limite d’opération",
		removeOperation: "Supprimer",
		invalidLimits:
			"Vérifiez les valeurs des limites, les identifiants d’opération et les doublons.",
		resetLimits: "Supprimer les limites propres au jeton",
	},
	defaultLicense: `${licenseTerms.label} par défaut`,
	defaultLicenses: `${licenseTerms.label} par défaut (plusieurs choix)`,
	defaultScoreRealm: `${realmTerms.label} de notation par défaut`,
	defaultScoreRealmHint: `Les notes des pages générales sont enregistrées dans ce ${realmTerms.inline}. Celles créées dans un autre ${realmTerms.inline} y restent.`,
	general: "Général",
	realmManageMode: `Créer les ${realmTerms.plural} en mode gestion par défaut`,
	on: "Activé",
	off: "Désactivé",
} satisfies typeof import("../zh-Hant/settings").default;
