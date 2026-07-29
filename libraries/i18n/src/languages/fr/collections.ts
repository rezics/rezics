import { insert } from "native-i18n";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: metadataTerms } = frTerminology.metadata;

export default {
	title: "Collections",
	favorites: "Favoris",
	newCollection: "Nouvelle collection",
	createDescription: "Créez une collection pour organiser, présenter et partager du contenu.",
	editCollection: "Gérer la collection",
	deleteCollection: "Supprimer la collection",
	deleteCollectionPrompt:
		"La collection et son organisation ne pourront pas être restaurées après leur suppression.",
	emptyCollections: "Vous n’avez pas encore de collection.",
	containingUnitEmpty: "Aucune collection publique ne contient encore cette œuvre.",
	emptyCollectionTitle: "Cette collection est vide",
	emptyCollectionBody: "Le contenu ajouté apparaîtra ici avec les mêmes cartes que dans le flux.",
	contentLabel: "Contenu de la collection",
	itemCount: insert("{{count}} éléments", { count: Number }),
	directCollectionHint:
		"Une collection est ajoutée comme un seul élément ; son contenu n’est pas importé récursivement.",
	save: {
		action: "Enregistrer",
		title: "Enregistrer dans des collections",
		directDescription: "Choisissez les Favoris ou une collection personnalisée.",
		reviewDescription:
			"Dans les collections personnalisées, l’avis sera placé sous l’œuvre qu’il évalue.",
		favoritesDescription: "Enregistrez rapidement sans créer d’organisation parent-enfant.",
		searchLabel: "Rechercher une collection",
		searchPlaceholder: "Saisissez le nom d’une collection",
		noMatches: "Aucune collection correspondante.",
		noCollections: "Vous n’avez pas encore de collection pouvant recevoir du contenu.",
		createLabel: "Créer une collection",
		createPlaceholder: "Nom de la collection",
		createAndSave: "Créer et enregistrer",
		manage: "Gérer les collections",
		saved: "Enregistré",
		notSaved: "Non enregistré",
	},
	workspace: {
		title: "Gestion de la collection",
		description: `Gérez le contenu, les ${metadataTerms.inline}, la structure, la présentation, les accès et l’historique.`,
		navigation: "Navigation de la gestion de la collection",
		overview: "Sections de gestion de la collection",
		backToCollection: "Retour à la collection",
		backToContent: "Retour au contenu",
		sections: {
			content: {
				label: "Contenu",
				description:
					"Modifiez le titre, le résumé et la couverture dans chaque langue de contenu.",
			},
			metadata: {
				label: metadataTerms.label,
				description: `Définissez les ${metadataTerms.inline} de statut et de visibilité, ou supprimez la collection.`,
			},
			items: {
				label: "Contenu et structure",
				description:
					"Ajoutez, supprimez, ordonnez, imbriquez et mettez du contenu en avant.",
			},
			presentation: {
				label: "Présentation",
				description: "Choisissez la disposition du contenu et la règle de tri.",
			},
			access: {
				label: "Accès",
				description:
					"Gérez les sujets d’autorisation, les permissions et les restrictions.",
			},
			history: {
				label: "Historique",
				description: "Consultez, comparez et restaurez les versions de la collection.",
			},
		},
	},
	items: {
		add: "Ajouter du contenu",
		target: "Contenu",
		role: "Rôle",
		parent: "Élément parent",
		topLevel: "Niveau supérieur",
		item: "Élément standard",
		featured: "Élément mis en avant",
		remove: "Supprimer",
		moveEarlier: "Déplacer vers le début",
		moveLater: "Déplacer vers la fin",
		saveStructure: "Mettre à jour la structure",
		empty: "Cette collection ne contient pas encore de contenu pouvant être géré.",
	},
	presentation: {
		layout: "Disposition",
		order: "Ordre",
		save: "Enregistrer la présentation",
		layouts: {
			flat: "Flux sur une colonne",
			nested: "Groupes parent-enfant",
			shelf: "Étagère de cartes",
		},
		orders: {
			manual: "Ordre manuel",
			name: "Nom",
			"added-at": "Date d’ajout",
		},
	},
	form: {
		language: "Langue du contenu",
		title: "Titre",
		summary: "Résumé",
		cover: "Couverture",
		status: "Statut",
		visibility: "Visibilité",
		save: "Enregistrer les modifications",
	},
	cancel: "Annuler",
	delete: "Supprimer",
	close: "Fermer",
} satisfies typeof import("../zh-Hant/collections").default;
