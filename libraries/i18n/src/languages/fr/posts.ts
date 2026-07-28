import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: postTerms } = frTerminology.post;
const { forms: realmTerms } = frTerminology.realm;

export default {
	title: postTerms.pluralLabel,
	create: `Nouvelle ${postTerms.inline}`,
	createTitle: `Publier une ${postTerms.inline}`,
	editTitle: `Modifier la ${postTerms.inline}`,
	publish: "Publier",
	untitled: `${postTerms.label} sans titre`,
	unknownAttribution: "Aucune attribution",
	publisher: "Éditeur",
	replies: `${postTerms.pluralLabel} de réponse`,
	replyPost: `${postTerms.label} de réponse`,
	signInToReply: "Connectez-vous pour répondre",
	openReplyComposer: "Participer à la discussion",
	hideChildReplies: "Masquer les réponses suivantes",
	showChildReplies: "Afficher les réponses suivantes",
	replyingLocked: `La création de ${postTerms.plural} de réponse est désactivée pour cette cible.`,
	noReplies: `Aucune ${postTerms.inline} de réponse pour le moment.`,
	replyBody: "Contenu de la réponse",
	reply: "Répondre",
	cancel: "Annuler",
	delete: "Supprimer",
	deleteTitle: `Supprimer la ${postTerms.inline} ?`,
	deleteDescription: "Cette action est irréversible.",
	deleteReplyTitle: `Supprimer la ${postTerms.inline} de réponse ?`,
	deleteReplyDescription: "Le contenu de la réponse ne sera plus affiché.",
	deletedReply: `Cette ${postTerms.inline} de réponse a été supprimée.`,
	editReplyTitle: `Modifier la ${postTerms.inline} de réponse`,
	viewThread: "Afficher toute la discussion",
	history: "Historique",
	historyTitle: "Historique des versions",
	noRevisions: "Aucune version pour le moment.",
	currentRevision: "Version actuelle",
	minorEdit: "Modification mineure",
	hiddenRevision: "Masquée",
	undoRevision: "Annuler cette modification",
	restoreRevision: "Restaurer cette version",
	compareWithParent: "Comparer à la version précédente",
	revisionBy: "Auteur de la modification",
	noEditSummary: "Aucun résumé de modification",
	compareTitle: "Différences entre les versions",
	before: "Avant",
	after: "Après",
	realm: realmTerms.label,
	selectRealmContext: `Choisir le ${realmTerms.inline} de contexte`,
	realmContextCard: `Informations sur le ${realmTerms.inline}`,
	subject: "Sujet",
	clearRealm: `Retirer le ${realmTerms.inline}`,
	clearSubject: "Retirer le sujet",
	attributions: "Crédits",
	viewRealm: `Afficher le ${realmTerms.inline}`,
	workspace: {
		description:
			"Modifiez le contenu, les relations d’attribution, les accès et l’historique des versions.",
		backToContent: "Retour au contenu",
		navigation: "Navigation de la gestion du contenu",
		sections: {
			main: {
				label: "Contenu",
				postDescription: `Modifiez le titre et le contenu de la ${postTerms.inline}.`,
				replyDescription: `Modifiez le contenu de la ${postTerms.inline} de réponse.`,
				reviewDescription:
					"Modifiez le titre, le résumé, le contenu et la note associés à l’avis.",
			},
			attributions: {
				label: "Relations d’attribution",
				description:
					"Consultez les attributions actuelles et gérez les propositions que l’autre partie doit accepter.",
			},
		},
		currentAttributions: "Attributions actuelles",
		currentAttributionsDescription:
			"Relations d’attribution établies et affichées sur ce contenu.",
	},
} satisfies typeof import("../zh-Hant/posts").default;
