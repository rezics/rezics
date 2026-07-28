import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";

const { forms: followTerms } = frTerminology.follow;
const { forms: realmTerms } = frTerminology.realm;

export default {
	center: {
		title: "Notifications",
		description:
			"Consultez les activités récentes et les mises à jour système qui demandent votre attention.",
		headerLabel: "Notifications",
		headerUnreadLabel: insert("Notifications, {{count}} non lues", { count: Number }),
		receivedInvitations: "Invitations d’accès reçues",
		invitationsDescription:
			"Consultez les invitations à accéder à une Unit envoyées par d’autres personnes et répondez-y.",
		backToNotifications: "Retour aux notifications",
		markAllRead: "Tout marquer comme lu",
		markRead: "Marquer comme lu",
		loadMore: "Charger plus de notifications",
		unread: "Non lue",
		emptyTitle: "Aucune notification pour le moment",
		emptyDescription: "Les nouvelles activités et mises à jour système apparaîtront ici.",
	},
	reply: {
		title: `Nouvelle réponse sur ${verbatimTerms.rezics.value}`,
		body: "Une personne a répondu à une conversation à laquelle vous participez.",
	},
	new_follower: {
		title: `Nouvelle ${followTerms.follower} sur ${verbatimTerms.rezics.value}`,
		body: `Une personne a commencé à vous ${followTerms.action}.`,
	},
	direct_message: {
		title: `Nouveau message sur ${verbatimTerms.rezics.value}`,
		body: "Vous avez reçu un nouveau message direct.",
	},
	moderation: {
		title: `Mise à jour de modération de ${verbatimTerms.rezics.value}`,
		body: "Le statut de modération de votre contenu a changé.",
	},
	report_resolution: {
		title: `Décision sur un signalement de ${verbatimTerms.rezics.value}`,
		body: "Une décision a été prise concernant l’un de vos signalements.",
	},
	realm: {
		title: `Mise à jour d’un ${realmTerms.inline} sur ${verbatimTerms.rezics.value}`,
		body: `Quelque chose a changé dans l’un des ${realmTerms.plural} auxquels vous appartenez.`,
	},
	system: {
		title: `Notification système de ${verbatimTerms.rezics.value}`,
		body: "Vous avez reçu une notification système.",
	},
	unit_access_invitation: {
		title: "Nouvelle invitation d’accès",
		body: "Une personne vous a invité à accéder à une Unit. Consultez l’invitation avant de répondre.",
	},
} satisfies typeof import("../zh-Hant/notifications").default;
