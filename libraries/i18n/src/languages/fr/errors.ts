import { insert } from "native-i18n";

export default {
	unknown: "Une erreur inattendue s’est produite.",
	unknownWithCode: insert("Une erreur inattendue s’est produite ({{code}}).", {
		code: String,
	}),
	unauthorized: "Connectez-vous pour continuer.",
	forbidden: "Vous n’avez pas l’autorisation d’effectuer cette action.",
	notFound: "Ce contenu est introuvable.",
	conflict: "Ce contenu a été modifié. Actualisez la page et réessayez.",
	invalid: "Le contenu envoyé est invalide.",
	unavailable: "Le service est temporairement indisponible. Réessayez plus tard.",
} satisfies typeof import("../zh-Hant/errors").default;
