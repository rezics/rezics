import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { frTerminology } from "@rezics/i18n/terminology/fr";
import { insert } from "native-i18n";

const { forms: realmTerms } = frTerminology.realm;
const { forms: zoneTerms } = frTerminology.zone;
const { forms: entityTerms } = frTerminology.entity;

export default {
	loading: "Chargement de l’éditeur…",
	loadFailed: "Impossible de charger l’éditeur.",
	paragraph: "Paragraphe",
	heading2: "Titre 2",
	heading3: "Titre 3",
	quote: "Citation",
	bold: "Gras",
	italic: "Italique",
	bulletList: "Liste à puces",
	numberedList: "Liste numérotée",
	link: "Lien",
	linkPrompt: `Utilisez une ${verbatimTerms.url.value} en ${verbatimTerms.http.value}, ${verbatimTerms.https.value}, ${verbatimTerms.mailto.value} ou une ${verbatimTerms.url.value} relative.`,
	linkUrl: verbatimTerms.url.value,
	openInNewTab: "Ouvrir dans un nouvel onglet",
	addLink: "Ajouter un lien",
	removeLink: "Supprimer le lien",
	invalidLink: `Saisissez une ${verbatimTerms.url.value} prise en charge.`,
	spoiler: "Spoiler",
	addSpoiler: "Marquer comme spoiler",
	removeSpoiler: "Retirer le spoiler",
	showSpoiler: "Afficher le spoiler",
	showScopedSpoiler: insert("Afficher le spoiler de « {{title}} »", { title: String }),
	spoilerPreview: "Contenu masqué",
	spoilerScope: "Élément associé (facultatif)",
	spoilerScopePlaceholder: "Rechercher des éléments",
	spoilerRange: "Appliquer à",
	spoilerRangeSelection: "Texte sélectionné",
	spoilerRangeBlocks: "Blocs sélectionnés",
	spoilerRangeBody: "Corps entier",
	spoilerLinkConflict: "Un texte avec un lien ne peut pas aussi être marqué comme spoiler.",
	spoilerTextOnlyHint:
		"Seul le texte est marqué ; les images et les autres contenus intégrés restent visibles.",
	undo: "Annuler",
	redo: "Rétablir",
	style: "Style du texte",
	preview: "Aperçu",
	placeholder: "Écrivez quelque chose ou saisissez / pour insérer des blocs.",
	slashMenu: "Insérer",
	slashHint: `Utilisez / pour les blocs ou ${verbatimTerms.profileSlugPrefix.value}, t/, e/, r/, z/ pour mentionner des Units.`,
	mentionSearchPrompt: "Saisissez du texte pour rechercher.",
	mentionUsers: "Utilisateurs",
	mentionTags: "Étiquettes",
	mentionEntities: entityTerms.pluralLabel,
	mentionRealms: realmTerms.pluralLabel,
	mentionZones: zoneTerms.pluralLabel,
	unavailableMention: "Unit indisponible",
	richText: "Texte enrichi",
	toolbar: "Barre d’outils de mise en forme",
} satisfies typeof import("../zh-Hant/editor").default;
