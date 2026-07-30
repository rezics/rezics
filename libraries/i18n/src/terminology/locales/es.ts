import { defineTerminology } from "@rezics/i18n/terminology/concepts";

export const esTerminology = defineTerminology("es", {
	follow: {
		status: "approved",
		forms: {
			actionLabel: "Seguir",
			action: "seguir",
			stateLabel: "Siguiendo",
			gerund: "seguimiento",
			followed: "seguido",
			undoActionLabel: "Dejar de seguir",
			undoAction: "dejar de seguir",
			follower: "seguidor",
			collectionLabel: "Seguidos",
		},
		forbidden: ["Suscribirse", "Suscripción", "Subscribe", "Subscription"],
	},
	zone: {
		status: "approved",
		forms: { label: "Zona", pluralLabel: "Zonas", inline: "zona", plural: "zonas" },
		forbidden: ["Zone", "Zones"],
	},
	realm: {
		status: "approved",
		forms: { label: "Ámbito", pluralLabel: "Ámbitos", inline: "ámbito", plural: "ámbitos" },
		forbidden: ["Realm", "Realms"],
	},
	dock: {
		status: "approved",
		forms: {
			label: "Ubicación",
			pluralLabel: "Ubicaciones",
			inline: "ubicación",
			plural: "ubicaciones",
		},
		forbidden: ["Dock", "Docks"],
	},
	unitSlug: {
		status: "approved",
		forms: {
			label: "Identificador de ruta",
			pluralLabel: "Identificadores de ruta",
			inline: "identificador de ruta",
			plural: "identificadores de ruta",
		},
		forbidden: ["Slug", "slug"],
	},
	post: {
		status: "approved",
		forms: {
			label: "Publicación",
			pluralLabel: "Publicaciones",
			inline: "publicación",
			plural: "publicaciones",
		},
		forbidden: ["Post", "Posts"],
	},
	video: {
		status: "approved",
		forms: { label: "Vídeo", pluralLabel: "Vídeos", inline: "vídeo", plural: "vídeos" },
		forbidden: [],
	},
	audio: {
		status: "approved",
		forms: { label: "Audio", pluralLabel: "Audios", inline: "audio", plural: "audios" },
		forbidden: [],
	},
	label: {
		status: "approved",
		forms: {
			label: "Etiqueta taxonómica",
			pluralLabel: "Etiquetas taxonómicas",
			inline: "etiqueta taxonómica",
			plural: "etiquetas taxonómicas",
		},
		forbidden: [],
	},
	tagStructure: {
		status: "approved",
		forms: {
			label: "Ruta de etiquetas",
			pluralLabel: "Rutas de etiquetas",
			inline: "ruta de etiquetas",
			plural: "rutas de etiquetas",
		},
		forbidden: ["Tag structure", "Structure tag"],
	},
	publicationLicense: {
		status: "approved",
		forms: { label: "Licencia de publicación", inline: "licencia de publicación" },
		forbidden: [],
	},
	metadata: {
		status: "approved",
		forms: { label: "Metadatos", inline: "metadatos" },
		forbidden: ["Información básica"],
	},
});
