import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: postTerms } = frTerminology.post;
const { forms: realmTerms } = frTerminology.realm;
const { forms: entityTerms } = frTerminology.entity;
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
	entityHelp: {
		label: "En savoir plus sur les crédits",
		title: "Informations sur les crédits",
		description: `Les crédits doivent être associés à une ${entityTerms.inline}. Si vous ne trouvez pas d’${entityTerms.inline} ou souhaitez créer, par exemple, une identité d’auteur pour vous-même, créez d’abord une ${entityTerms.inline}.`,
		createEntity: `Créer une ${entityTerms.inline}`,
		close: "Fermer",
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
			label: entityTerms.pluralLabel,
			description: `Consultez et gérez les ${entityTerms.plural} liées à votre travail.`,
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
	realmTagContext: {
		label: `Explication de Tag du ${realmTerms.label}`,
		description: `Créez l’explication wiki de ce ${realmTerms.inline} pour un Tag.`,
	},
	communityUnitSearch: {
		policyTitle: "Rechercher avant de créer",
		policy: "Afin de préserver une communauté saine, effectuez une recherche avant de créer une entrée publique et vérifiez que le contenu souhaité n’existe pas déjà. Tout usage abusif de cette fonction peut entraîner des sanctions.",
		confirmationLabel: insert(
			"J’ai effectué une recherche parmi les {{subject}} et confirmé que cette entrée n’existe pas déjà.",
			{ subject: String },
		),
		prompt: insert("Rechercher les {{subject}} existants", { subject: String }),
		pageTitle: insert("Rechercher les {{subject}} existants", { subject: String }),
		pageDescription: insert(
			"Vérifiez si les {{subject}} que vous souhaitez créer existent déjà.",
			{
				subject: String,
			},
		),
		backToSection: insert("Retour aux {{subject}}", { subject: String }),
		searchLabel: insert("Rechercher des {{subject}}", { subject: String }),
		searchPlaceholder: insert("Saisissez le nom des {{subject}}", { subject: String }),
		searchAction: "Rechercher",
		searchHint: "Saisissez un nom pour rechercher les entrées susceptibles d’exister déjà.",
		searchFailed:
			"La recherche est temporairement indisponible. Réessayez ou revenez au formulaire de création.",
		resultsTitle: "Entrées existantes possibles",
		noResultsTitle: insert("Aucun {{subject}} correspondant trouvé", { subject: String }),
		noResultsDescription:
			"Après avoir vérifié les termes de recherche, vous pouvez poursuivre la création.",
		realmTagContextOnly: `Seules les étiquettes officiellement expliquées par ce ${realmTerms.inline} apparaissent ici. Si une étiquette manque, la gestion du ${realmTerms.inline} doit d’abord créer son explication.`,
		notListedTitle: "Aucun de ces résultats ne correspond ?",
		notListedDescription:
			"Examinez d’abord les entrées similaires. Ne continuez que si aucune ne correspond au contenu recherché.",
		createAction: "Poursuivre la création",
		subjects: {
			book: "livres",
			software: "logiciels",
			media: "médias",
			person: "personnes",
			organization: "organisations",
			character: "personnages",
			tag: "étiquettes",
		},
	},
	list: {
		create: "Créer",
		empty: "Aucun contenu ne correspond aux filtres actuels.",
		untitled: "Contenu sans titre",
		contributionCount: insert("Contributions : {{count}}", { count: Number }),
		activity: {
			visited: "Consulté",
			updated: "Mis à jour",
			created: "Créé",
			relevant: "Pertinent",
		},
	},
	filters: {
		viewLabel: "Lien avec le travail",
		permissionLabel: "Autorisation actuelle",
		workStateLabel: "État du travail",
		statusLabel: "Statut du contenu",
		visibilityLabel: "Visibilité",
		sortLabel: "Ordre de tri",
		any: "Tous",
		more: "Plus de filtres",
		clear: "Effacer les filtres",
		cancel: "Annuler",
		apply: "Appliquer les filtres",
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
			"unit.realm-publication.manage": `Peut gérer la diffusion dans ${realmTerms.label}`,
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
