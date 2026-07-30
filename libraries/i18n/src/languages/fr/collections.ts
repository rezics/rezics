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
	publishers: {
		label: "Éditeur",
		unknown: "Aucun éditeur crédité",
		current: "Éditeurs actuels",
		currentDescription:
			"Ces profils sont crédités comme éditeurs sur la collection et dans les flux.",
	},
	save: {
		action: "Enregistrer",
		title: "Enregistrer dans des collections",
		directDescription:
			"Choisissez les Favoris ou une collection personnalisée. Lorsqu’un avis est enregistré dans une collection personnalisée, son objet est ajouté d’abord si nécessaire.",
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
		description: `Gérez le contenu, les ${metadataTerms.inline}, l’ordre, les éditeurs, les accès et l’historique.`,
		navigation: "Navigation de la gestion de la collection",
		overview: "Sections de gestion de la collection",
		backToCollection: "Retour à la collection",
		backToOverview: "Retour aux paramètres",
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
				label: "Contenu et ordre",
				description: "Ajoutez, supprimez, sélectionnez et ordonnez le contenu.",
			},
			publishers: {
				label: "Éditeurs",
				description: "Gérez les profils d’éditeur affichés publiquement.",
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
		selectAll: "Sélectionner tous les éléments chargés",
		clearSelection: "Effacer la sélection",
		selectedCount: insert("{{count}} éléments sélectionnés", { count: Number }),
		selectItem: insert("Sélectionner {{title}}", { title: String }),
		removeItem: insert("Supprimer {{title}}", { title: String }),
		move: "Déplacer",
		moveTitle: "Déplacer les éléments sélectionnés",
		moveDescription:
			"L’ordre relatif est conservé et la modification est appliquée atomiquement.",
		destination: "Destination",
		moveToStart: "Déplacer au début",
		moveToEnd: "Déplacer à la fin",
		moveAfter: "Déplacer après un élément",
		afterItem: "Élément précédent",
		chooseDestination: "Choisir un élément",
		applyMove: "Appliquer le déplacement",
		empty: "Cette collection ne contient pas encore de contenu pouvant être géré.",
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
