import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";

const { forms: followTerms } = deTerminology.follow;
const { forms: labelTerms } = deTerminology.label;
const { forms: postTerms } = deTerminology.post;
const { forms: realmTerms } = deTerminology.realm;
const { forms: tagStructureTerms } = deTerminology.tagStructure;
const { forms: unitSlugTerms } = deTerminology.unitSlug;
const { forms: zoneTerms } = deTerminology.zone;

export default {
	home: "Startseite",
	studio: verbatimTerms.studio.value,
	units: "Units",
	entity: "Entität",
	realm: realmTerms.label,
	collections: "Sammlungen",
	favorites: "Gespeichert",
	progress: "Fortschritt",
	me: "Ich",
	skipToContent: "Zum Hauptinhalt springen",
	navigation: "Navigation",
	content: "Inhalt",
	userMenu: {
		label: "Benutzermenü",
		description: "Zeige dein Profil an, passe Einstellungen an oder melde dich ab.",
		back: "Zurück zum Benutzermenü",
		close: "Benutzermenü schließen",
		viewProfile: "Profil anzeigen",
		myContent: "Meine Inhalte",
		settings: "Einstellungen",
		console: "Verwaltungskonsole",
		invitations: "Erhaltene Zugriffseinladungen",
		signOut: "Abmelden",
	},
	sidebar: {
		title: "Hauptnavigation",
		description: `Öffne die Startseite, häufig verwendete Ziele sowie ${zoneTerms.pluralLabel} und ${realmTerms.pluralLabel}, denen du folgst.`,
		open: "Hauptnavigation öffnen",
		close: "Hauptnavigation schließen",
		expand: "Seitenleiste ausklappen",
		collapse: "Seitenleiste einklappen",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `Alle ${zoneTerms.pluralLabel}`,
		allRealms: `Alle ${realmTerms.pluralLabel}`,
		zonesEmpty: `${zoneTerms.pluralLabel}, denen du folgst, erscheinen hier.`,
		realmsEmpty: `${realmTerms.pluralLabel}, denen du folgst, erscheinen hier.`,
		loading: "Inhalt der Seitenleiste wird geladen.",
		error: "Der Inhalt der Seitenleiste konnte nicht geladen werden.",
	},
	following: {
		title: followTerms.collectionLabel,
		all: "Alle gefolgten Inhalte",
		empty: "Units, denen du folgst, erscheinen hier.",
		description: "Filtere, fixiere und organisiere die Units, denen du folgst.",
		filter: "Typen gefolgter Units filtern",
		favorite: "Fixieren",
		unfavorite: "Lösen",
		types: {
			slug_namespace: `${unitSlugTerms.label}-Namensraum`,
			profile: "Profil",
			book: "Buch",
			software: "Software",
			media: "Medien",
			release: "Veröffentlichung",
			entity: "Entität",
			label: labelTerms.label,
			tag: "Tag",
			structure: tagStructureTerms.label,
			series: "Reihe",
			zone: zoneTerms.label,
			zone_page: `${zoneTerms.label}-Seite`,
			collection: "Sammlung",
			post: postTerms.label,
			poll: "Umfrage",
			realm: realmTerms.label,
			realm_rule: `${realmTerms.label}-Regel`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
