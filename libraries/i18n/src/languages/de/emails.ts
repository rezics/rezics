import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage:
			"Dies ist eine automatisch erstellte Nachricht. Bitte antworte nicht auf diese E-Mail.",
		copyright: insert(`© {{year}} ${verbatimTerms.rezics.value}. Alle Rechte vorbehalten.`, {
			year: Number,
		}),
	},
	resetPassword: {
		subject: `${verbatimTerms.rezics.value}-Passwort zurücksetzen`,
		preview: `${verbatimTerms.rezics.value}-Passwort zurücksetzen`,
		heading: "Passwort zurücksetzen",
		body: "Wir haben eine Anfrage zum Zurücksetzen deines Kontopassworts erhalten. Verwende innerhalb einer Stunde die Schaltfläche unten, um ein neues Passwort festzulegen.",
		actionLabel: "Passwort zurücksetzen",
		fallback: "Falls die Schaltfläche nicht funktioniert, öffne diesen Link:",
		ignoreNotice:
			"Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort wird nicht geändert.",
	},
	verifyEmail: {
		subject: `E-Mail-Adresse für ${verbatimTerms.rezics.value} bestätigen`,
		preview: `E-Mail-Adresse für ${verbatimTerms.rezics.value} bestätigen`,
		heading: "E-Mail-Adresse bestätigen",
		body: "Bestätige, dass diese E-Mail-Adresse dir gehört, um die Einrichtung deines Kontos abzuschließen.",
		actionLabel: "E-Mail-Adresse bestätigen",
		fallback: "Falls die Schaltfläche nicht funktioniert, öffne diesen Link:",
		ignoreNotice:
			"Wenn du kein Konto erstellt und keine Bestätigung angefordert hast, kannst du diese E-Mail ignorieren.",
	},
} satisfies typeof import("../zh-Hant/emails").default;
