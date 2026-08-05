import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { deTerminology } from "@rezics/i18n/terminology/de";
import { insert } from "native-i18n";

const { forms: realmTerms } = deTerminology.realm;
const { forms: zoneTerms } = deTerminology.zone;
const { forms: entityTerms } = deTerminology.entity;

export default {
	loading: "Editor wird geladen…",
	loadFailed: "Der Editor konnte nicht geladen werden.",
	paragraph: "Absatz",
	heading2: "Überschrift 2",
	heading3: "Überschrift 3",
	quote: "Zitat",
	bold: "Fett",
	italic: "Kursiv",
	bulletList: "Aufzählung",
	numberedList: "Nummerierte Liste",
	link: "Link",
	linkPrompt: `Verwende eine ${verbatimTerms.http.value}-, ${verbatimTerms.https.value}-, ${verbatimTerms.mailto.value}- oder relative ${verbatimTerms.url.value}.`,
	linkUrl: verbatimTerms.url.value,
	openInNewTab: "In neuem Tab öffnen",
	addLink: "Link hinzufügen",
	removeLink: "Link entfernen",
	invalidLink: `Gib eine unterstützte ${verbatimTerms.url.value} ein.`,
	spoiler: "Spoiler",
	addSpoiler: "Als Spoiler markieren",
	removeSpoiler: "Spoiler-Markierung entfernen",
	showSpoiler: "Spoiler anzeigen",
	showScopedSpoiler: insert("Spoiler zu „{{title}}“ anzeigen", { title: String }),
	spoilerPreview: "Spoiler-Inhalt",
	spoilerScope: "Zugehöriger Eintrag (optional)",
	spoilerScopePlaceholder: "Einträge suchen",
	spoilerRange: "Anwenden auf",
	spoilerRangeSelection: "Ausgewählten Text",
	spoilerRangeBlocks: "Ausgewählte Blöcke",
	spoilerRangeBody: "Gesamten Inhalt",
	spoilerLinkConflict: "Verlinkter Text kann nicht zugleich als Spoiler markiert werden.",
	spoilerTextOnlyHint:
		"Nur Text wird markiert; Bilder und andere eingebettete Inhalte bleiben sichtbar.",
	undo: "Rückgängig",
	redo: "Wiederholen",
	style: "Textstil",
	preview: "Vorschau",
	placeholder: "Schreibe etwas oder tippe / für Blöcke.",
	slashMenu: "Einfügen",
	slashHint: `Verwende / für Blöcke oder ${verbatimTerms.profileSlugPrefix.value}, t/, e/, r/, z/ für Unit-Erwähnungen.`,
	mentionSearchPrompt: "Tippe, um zu suchen.",
	mentionUsers: "Benutzer",
	mentionTags: "Tags",
	mentionEntities: entityTerms.pluralLabel,
	mentionRealms: realmTerms.pluralLabel,
	mentionZones: zoneTerms.pluralLabel,
	unavailableMention: "Nicht verfügbare Unit",
	richText: "Rich Text",
	toolbar: "Formatierungswerkzeuge",
} satisfies typeof import("../zh-Hant/editor").default;
