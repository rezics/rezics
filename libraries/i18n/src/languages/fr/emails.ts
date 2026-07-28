import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage:
			"Ce message a été envoyé automatiquement. Merci de ne pas répondre à cet e-mail.",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}. Tous droits réservés.`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `Réinitialisez votre mot de passe ${verbatimTerms.rezics.value}`,
		preview: `Réinitialisez votre mot de passe ${verbatimTerms.rezics.value}`,
		heading: "Réinitialisez votre mot de passe",
		body: "Nous avons reçu une demande de réinitialisation du mot de passe de votre compte. Utilisez le bouton ci-dessous dans un délai d’une heure pour choisir un nouveau mot de passe.",
		actionLabel: "Réinitialiser le mot de passe",
		fallback: "Si le bouton ne fonctionne pas, ouvrez ce lien :",
		ignoreNotice:
			"Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail. Votre mot de passe ne sera pas modifié.",
	},
	verifyEmail: {
		subject: `Vérifiez votre adresse e-mail ${verbatimTerms.rezics.value}`,
		preview: `Vérifiez votre adresse e-mail ${verbatimTerms.rezics.value}`,
		heading: "Vérifiez votre adresse e-mail",
		body: "Confirmez que cette adresse e-mail vous appartient pour terminer la configuration de votre compte.",
		actionLabel: "Vérifier l’adresse e-mail",
		fallback: "Si le bouton ne fonctionne pas, ouvrez ce lien :",
		ignoreNotice:
			"Si vous n’avez pas créé de compte ni demandé cette vérification, vous pouvez ignorer cet e-mail.",
	},
} satisfies typeof import("../zh-Hant/emails").default;
