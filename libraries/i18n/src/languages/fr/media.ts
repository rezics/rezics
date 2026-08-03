import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} ou ${verbatimTerms.avif.value}`;

export default {
	choose: "Choisir, déposer ou coller une image",
	hint: `${SupportedImageFormats}, jusqu’à 10 ${verbatimTerms.mib.value}`,
	replace: "Remplacer",
	remove: "Supprimer",
	cancel: "Annuler",
	invalid: `Choisissez une image ${SupportedImageFormats} de moins de 10 ${verbatimTerms.mib.value}.`,
	current: "Remplacement pour la langue actuelle",
	displayPreview: "Aire affichée",
	editPresentation: "Ajuster la zone affichée",
	upload: {
		preparing: "Préparation du téléversement de l’image…",
		uploading: "Téléversement de l’image…",
		progress: insert("Téléversement de l’image… {{percentage}} %", { percentage: Number }),
		processing: "Téléversement terminé. Traitement de l’image…",
	},
	localizationFallback: {
		notice: "Chaque ressource d’image applique indépendamment le repli linguistique.",
		title: "Repli linguistique des images",
		description:
			"L’avatar, la bannière et la couverture sont résolus séparément de la langue choisie pour le texte.",
		viewerPreferences:
			"Les images sont recherchées selon les préférences linguistiques de chaque personne. Si une langue ne fournit pas l’image concernée, elle est ignorée et la recherche continue.",
		defaultOrder:
			"Si aucune langue préférée ne fournit cette image, la recherche continue selon l’ordre de localisation par défaut du contenu.",
		noImage:
			"Si aucune localisation ne fournit l’image, aucune image localisée n’est renvoyée.",
		textDifference:
			"Le texte suit une règle différente : une localisation complète est choisie, sans repli champ par champ du titre, du résumé ou de la description.",
		example:
			"Par exemple, si une personne préfère le chinois puis l’anglais, que le chinois fournit le texte et la bannière mais pas l’avatar, et que l’anglais fournit un avatar, elle voit le texte et la bannière en chinois ainsi que l’avatar anglais.",
		close: "Fermer les règles de repli linguistique des images",
	},
	presentationEditor: {
		title: {
			avatar: "Ajuster l’avatar",
			banner: "Ajuster la bannière",
			cover: "Ajuster la couverture",
		},
		description: {
			avatar: "Déplacez et agrandissez l’image dans le recadrage carré. L’aperçu circulaire de l’avatar ne supprime pas les coins de l’original.",
			banner: "Déplacez et agrandissez l’image dans le recadrage fixe 4:1. Les nouvelles bannières commencent en haut à gauche.",
			cover: "Conservez l’image complète par défaut, ou utilisez un recadrage fixe 3:4 lorsque la composition est prioritaire.",
		},
		close: "Fermer le réglage de l’image",
		loading: "Chargement de l’image d’origine…",
		loadFailed: "L’image d’origine ou sa présentation n’a pas pu être chargée.",
		cropArea:
			"Cadre de recadrage de l’image. Faites glisser pour le repositionner, utilisez la molette pour zoomer ou les touches fléchées pour le déplacer.",
		zoom: "Zoom",
		zoomIn: "Agrandir",
		zoomOut: "Réduire",
		reset: "Réinitialiser",
		avatarPreview: "Aperçu circulaire",
		bannerPreview: "Aperçu de la bannière",
		coverPreview: "Aperçu de la couverture complète",
		coverMode: {
			label: "Mode d’affichage de la couverture",
			contain: "Afficher l’image complète",
			crop: "Recadrer au format 3:4",
			containDescription:
				"L’image complète reste visible. Le cadre utilise un arrière-plan flouté lorsque ses proportions diffèrent.",
			cropDescription: "Seule la zone 3:4 sélectionnée est transmise et affichée.",
		},
		cancel: "Annuler",
		save: "Enregistrer la zone affichée",
		saveFailed: "La zone affichée n’a pas pu être enregistrée. Réessayez.",
	},
	avatarPicker: {
		setup: "Configurer l’avatar",
		edit: "Modifier l’avatar",
		dialogTitle: "Choisir un avatar",
		dialogDescription: "Importez une image, ou choisissez une icône ou un emoji.",
		close: "Fermer le sélecteur d’avatar",
		source: "Source de l’avatar",
		useInherited: "Utiliser l’avatar hérité",
		recent: "Utilisés récemment",
		typeLabel: "Type d’avatar",
		tabs: { image: "Image", icon: "Icône", emoji: "Emoji" },
		preview: "Aperçu de l’avatar",
		icon: {
			search: "Rechercher des icônes",
			featured: "Icônes courantes",
			style: "Style d’icône",
			styles: { fas: "Plein", fab: "Marques" },
			loading: "Recherche d’icônes…",
			empty: "Aucune icône correspondante n’a été trouvée.",
			failed: "La recherche d’icônes est momentanément indisponible. Réessayez plus tard.",
			select: insert("Sélectionner l’icône : {{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} n’est pas configuré, les aperçus d’icônes ne peuvent donc pas être affichés.`,
		},
		emoji: {
			search: "Rechercher des emojis",
			skinTone: "Modifier la couleur de peau",
			loading: "Chargement des emojis…",
			empty: "Aucun emoji correspondant n’a été trouvé.",
		},
	},
	bannerPreview: {
		description: "La bannière transmise utilise la zone 4:1 enregistrée.",
		showOriginal: "Voir l’image complète",
		hideOriginal: "Masquer l’image complète",
		original: "Image complète",
	},
	roles: {
		avatar: {
			title: "Avatar",
			inherit: "Utiliser le premier avatar disponible dans l’ordre des langues",
			failed: "L’avatar n’a pas pu être importé. Réessayez.",
		},
		banner: {
			title: "Bannière",
			inherit: "Utiliser la première bannière disponible dans l’ordre des langues",
			failed: "La bannière n’a pas pu être importée. Réessayez.",
		},
		cover: {
			title: "Couverture",
			inherit: "Utiliser la première couverture disponible dans l’ordre des langues",
			failed: "La couverture n’a pas pu être importée. Réessayez.",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
