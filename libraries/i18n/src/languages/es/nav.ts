import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: followTerms } = esTerminology.follow;
const { forms: labelTerms } = esTerminology.label;
const { forms: postTerms } = esTerminology.post;
const { forms: videoTerms } = esTerminology.video;
const { forms: audioTerms } = esTerminology.audio;
const { forms: realmTerms } = esTerminology.realm;
const { forms: entityTerms } = esTerminology.entity;
const { forms: unitSlugTerms } = esTerminology.unitSlug;
const { forms: zoneTerms } = esTerminology.zone;

export default {
	home: "Inicio",
	studio: verbatimTerms.studio.value,
	units: "Units",
	entity: entityTerms.label,
	realm: realmTerms.label,
	collections: "Colecciones",
	favorites: "Guardado",
	progress: "Progreso",
	me: "Yo",
	skipToContent: "Ir al contenido principal",
	navigation: "Navegación",
	content: "Contenido",
	userMenu: {
		label: "Menú de usuario",
		description: "Consulta tu perfil, ajusta tus preferencias y configuración o cierra sesión.",
		back: "Volver al menú de usuario",
		close: "Cerrar el menú de usuario",
		viewProfile: "Ver perfil",
		myContent: "Mi contenido",
		myReports: "Mis denuncias",
		settings: "Configuración",
		console: "Consola de gestión",
		invitations: "Invitaciones de acceso recibidas",
		signOut: "Cerrar sesión",
	},
	sidebar: {
		title: "Navegación principal",
		description: `Abre Inicio, tus destinos habituales y los ${zoneTerms.plural} y ${realmTerms.plural} que sigues.`,
		open: "Abrir la navegación principal",
		close: "Cerrar la navegación principal",
		expand: "Expandir la barra lateral",
		collapse: "Contraer la barra lateral",
		zones: zoneTerms.pluralLabel,
		realms: realmTerms.pluralLabel,
		allZones: `Todas las ${zoneTerms.plural}`,
		allRealms: `Todos los ${realmTerms.plural}`,
		zonesEmpty: `Las ${zoneTerms.plural} que sigas aparecerán aquí.`,
		realmsEmpty: `Los ${realmTerms.plural} que sigas aparecerán aquí.`,
		loading: "Cargando el contenido de la barra lateral.",
		error: "No se ha podido cargar el contenido de la barra lateral.",
	},
	following: {
		title: followTerms.collectionLabel,
		all: "Todo lo que sigues",
		empty: "Las Units que sigas aparecerán aquí.",
		description: "Filtra, fija y organiza las Units que sigues.",
		filter: "Filtrar los tipos de Units seguidas",
		favorite: "Fijar",
		unfavorite: "Dejar de fijar",
		types: {
			slug_namespace: `Espacio de nombres de ${unitSlugTerms.inline}`,
			profile: "Perfil",
			book: "Libro",
			software: "Software",
			media: "Contenido multimedia",
			video: videoTerms.label,
			audio: audioTerms.label,
			release: "Versión",
			entity: entityTerms.label,
			label: labelTerms.label,
			tag: "Etiqueta",
			series: "Serie",
			zone: zoneTerms.label,
			zone_page: `Página de ${zoneTerms.inline}`,
			collection: "Colección",
			post: postTerms.label,
			poll: "Encuesta",
			realm: realmTerms.label,
			realm_rule: `Regla de ${realmTerms.inline}`,
		},
	},
} satisfies typeof import("../zh-Hant/nav").default;
