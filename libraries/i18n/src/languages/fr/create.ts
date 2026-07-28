import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: postTerms } = frTerminology.post;
const { forms: realmTerms } = frTerminology.realm;
const { forms: zoneTerms } = frTerminology.zone;

export default {
	workspace: {
		title: verbatimTerms.studio.value,
		description: "Consultez le contenu que vous avez créé, entretenu ou reçu en gestion.",
		backToApplication: `Retour à ${verbatimTerms.rezics.value}`,
		navigation: `Navigation de ${verbatimTerms.studio.value}`,
		overview: "Types de contenu",
		backToOverview: "Retour aux types de contenu",
	},
	sections: {
		book: {
			label: "Livres",
			description: "Consultez et gérez les livres liés à votre travail.",
		},
		software: {
			label: "Logiciels",
			description: "Consultez et gérez les entrées de logiciels liées à votre travail.",
		},
		media: {
			label: "Médias",
			description: "Consultez et gérez les médias liés à votre travail.",
		},
		entity: {
			label: "Entrées de catalogue",
			description: "Consultez et gérez les entrées de catalogue liées à votre travail.",
		},
		tag: {
			label: "Étiquettes",
			description: "Consultez et gérez les étiquettes liées à votre travail.",
		},
		realm: {
			label: realmTerms.label,
			description: `Consultez et gérez les ${realmTerms.plural} liés à votre travail.`,
		},
		zone: {
			label: zoneTerms.label,
			description: `Consultez et gérez les ${zoneTerms.plural} liés à votre travail.`,
		},
		post: {
			label: postTerms.label,
			description: `Consultez et gérez les ${postTerms.plural} liées à votre travail.`,
		},
		wiki: {
			label: "Articles de wiki",
			description: "Consultez et gérez les articles de wiki que vous entretenez.",
		},
		collection: {
			label: "Collections",
			description: "Consultez et gérez les collections liées à votre travail.",
		},
		review: { label: "Avis", description: "Consultez et gérez les avis liés à votre travail." },
		poll: {
			label: "Sondages",
			description: "Consultez et gérez les sondages liés à votre travail.",
		},
	},
	list: {
		create: "Créer",
		empty: "Aucun contenu ne correspond aux filtres actuels.",
		untitled: "Contenu sans titre",
	},
	filters: {
		viewLabel: "Lien avec le travail",
		permissionLabel: "Autorisation actuelle",
		workStateLabel: "État du travail",
		statusLabel: "Statut du contenu",
		visibilityLabel: "Visibilité",
		sortLabel: "Ordre de tri",
		any: "Tous",
		views: {
			all: "Mon travail",
			created: "Créé par moi",
			contributed: "Avec ma contribution",
			assigned: "Attribué directement",
			delegated: "Délégué par l’équipe",
		},
		permissions: {
			"unit.update": "Peut modifier",
			"unit.status.update": "Peut changer le statut",
			"unit.access.manage": "Peut gérer les accès",
		},
		workStates: { actionable: "Action possible", blocked: "Actuellement bloqué" },
		statuses: { draft: "Brouillon", published: "Publié", archived: "Archivé" },
		visibilities: { public: "Public", unlisted: "Non répertorié", private: "Privé" },
		sorts: {
			recent: "Consulté récemment",
			updated: "Mis à jour récemment",
			created: "Créé récemment",
			relevant: "Pertinent récemment",
		},
	},
	relations: {
		created: "Créateur",
		contributed: "Contributeur",
		assigned: "Attribué directement",
		delegated: "Délégué par l’équipe",
		blocked: "Actuellement bloqué",
	},
	developmentBadge: "En cours de développement",
} satisfies typeof import("../zh-Hant/create").default;
