export default {
	title: "Historique des révisions",
	description:
		"Consultez les modifications, comparez les révisions ou restaurez le contenu lorsque vous y êtes autorisé.",
	noRevisions: "Aucune révision pour le moment.",
	currentRevision: "Révision actuelle",
	minorEdit: "Modification mineure",
	hiddenRevision: "Masquée",
	undoRevision: "Annuler cette modification",
	restoreRevision: "Restaurer cette révision",
	compareWithParent: "Comparer à la précédente",
	revisionBy: "Éditeur",
	noEditSummary: "Aucun résumé de modification",
	compareTitle: "Différence entre les révisions",
	before: "Avant",
	after: "Après",
	backToHistory: "Retour à l’historique des révisions",
	backToEditor: "Retour à l’éditeur",
	bytes: "octets",
	visibility: {
		hiddenBadge: "Masquée",
		suppressedBadge: "Accès restreint",
		protectedSummary: "Résumé de modification protégé",
		manage: "Gérer la visibilité",
		title: "Gérer la visibilité de la révision",
		description:
			"Restreignez l’accès au contenu, au résumé de modification ou à l’identité de l’éditeur. Chaque changement est audité.",
		copyrightPreset: "Appliquer la protection du droit d’auteur",
		copyrightPresetDescription:
			"Masquez le contenu et le résumé afin que seules les personnes autorisées à supprimer puissent les consulter.",
		levelLabel: "Niveau de protection",
		levels: {
			visible: "Visible",
			hidden: "Masquée aux lecteurs",
			suppressed: "Suppresseurs uniquement",
		},
		levelDescriptions: {
			visible: "Toute personne pouvant lire cette Unit peut consulter la révision.",
			hidden: "Seules les personnes autorisées à modérer la plateforme peuvent consulter les données sélectionnées.",
			suppressed:
				"Seules les personnes autorisées à supprimer peuvent consulter les données sélectionnées.",
		},
		fieldsLabel: "Données protégées",
		fields: {
			content: "Contenu de la révision",
			summary: "Résumé de modification",
			actor: "Identité de l’éditeur",
		},
		currentRevisionContent:
			"Le contenu de la révision actuelle ne peut pas être masqué. Publiez d’abord une révision assainie, puis protégez l’ancienne.",
		reasonLabel: "Motif",
		selectReason: "Sélectionner un motif",
		atLeastOneField: "Sélectionnez au moins un élément à protéger.",
		cancel: "Annuler",
		save: "Enregistrer la visibilité",
	},
	structureKinds: {
		create: "Structure créée",
		update: "Structure mise à jour",
		delete: "Structure supprimée",
		restore: "Structure restaurée",
	},
} satisfies typeof import("../zh-Hant/history").default;
