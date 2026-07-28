import { insert } from "native-i18n";

export default {
	unknown: "Ein unerwarteter Fehler ist aufgetreten.",
	unknownWithCode: insert("Ein unerwarteter Fehler ist aufgetreten ({{code}}).", {
		code: String,
	}),
	unauthorized: "Melde dich an, um fortzufahren.",
	forbidden: "Du hast keine Berechtigung für diese Aktion.",
	notFound: "Dieser Inhalt wurde nicht gefunden.",
	conflict: "Dieser Inhalt wurde geändert. Lade die Seite neu und versuche es erneut.",
	invalid: "Der übermittelte Inhalt ist ungültig.",
	unavailable: "Der Dienst ist vorübergehend nicht verfügbar. Versuche es später erneut.",
} satisfies typeof import("../zh-Hant/errors").default;
