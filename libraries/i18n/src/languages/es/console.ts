import { insert } from "native-i18n";

import { esTerminology } from "@rezics/i18n/terminology/es";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const { forms: realmTerms } = esTerminology.realm;

export default {
	title: "Consola de gestión",
	description:
		"Las capacidades de la plataforma habilitan cada área de gestión; no representan una identidad de usuario ni una relación laboral.",
	backToApplication: "Volver a la aplicación",
	navigation: "Navegación de la consola de gestión",
	overview: "Todas las áreas de gestión",
	cancel: "Cancelar",
	sections: {
		access: {
			label: "Acceso a la plataforma",
			description:
				"Consulta o gestiona las capacidades de plataforma concedidas a los perfiles, incluidos el vencimiento y el origen de cada concesión.",
		},
		audit: {
			label: "Auditoría de seguridad",
			description: `Revisa los eventos administrativos importantes y las decisiones de seguridad de la plataforma, los ${realmTerms.plural} y las Units.`,
		},
	},
	access: {
		searchTitle: "Buscar un perfil",
		searchLabel: "Nombre o correo electrónico de inicio de sesión",
		searchPlaceholder: "Introduce un nombre o correo electrónico",
		search: "Buscar",
		searchResults: "Resultados de búsqueda",
		activeProfiles: "Perfiles con acceso activo a la plataforma",
		noProfiles: "No hay ninguna concesión activa de capacidades de plataforma.",
		noSearchResults: "No se han encontrado perfiles coincidentes.",
		selectProfile: "Selecciona un perfil para consultar su acceso a la plataforma.",
		capabilityCount: insert("{{count}} capacidades", { count: Number }),
		capability: "Capacidad",
		expiry: "Vencimiento",
		expiryFor: insert("Vencimiento de {{capability}}", { capability: String }),
		noExpiry: "Sin vencimiento",
		provenance: "Origen de la concesión",
		grantProvenance: insert("Concedida por {{profileId}} el {{date}}", {
			profileId: String,
			date: String,
		}),
		notGranted: "No concedida directamente",
		readOnly: "Puedes consultar el acceso a la plataforma, pero no modificarlo.",
		grantAll: "Conceder todas las capacidades",
		clearAll: "Retirar todas las capacidades",
		save: "Guardar el acceso a la plataforma",
		revokeAllTitle: "¿Revocar todo el acceso a la plataforma de este perfil?",
		revokeAllDescription:
			"Esta acción revoca todas las concesiones activas. El servidor rechaza el cambio si retiraría el último administrador de acceso a la plataforma sin vencimiento.",
		confirmRevokeAll: "Confirmar la revocación completa",
	},
	audit: {
		category: "Categoría del evento",
		allCategories: "Todas las categorías",
		categories: {
			admin_activity: "Actividad administrativa",
			policy_denied: "Denegación por política",
			system_event: "Evento del sistema",
		},
		outcome: "Resultado",
		allOutcomes: "Todos los resultados",
		outcomes: {
			succeeded: "Correcto",
			denied: "Denegado",
			failed: "Fallido",
		},
		time: "Fecha y hora",
		action: "Acción",
		actor: "Autor",
		authority: "Autoridad",
		authorities: {
			platform: "Plataforma",
			realm: realmTerms.label,
			unit: "Unit",
		},
		empty: "Ningún evento de auditoría coincide con los filtros actuales.",
		previousPage: "Página anterior",
		nextPage: "Página siguiente",
		selectEvent: "Selecciona un evento para consultar su registro de auditoría completo.",
		detailsTitle: "Detalles del evento",
		systemActor: "Sistema",
		credential: "Tipo de credencial",
		credentialId: `${verbatimTerms.id.value} de credencial`,
		credentials: {
			session: "Sesión interactiva",
			api_token: `Token de ${verbatimTerms.api.value}`,
			bootstrap: "Inicio del sistema",
			system: "Proceso del sistema",
		},
		scopedAuthority: insert("{{kind}} ({{id}})", { kind: String, id: String }),
		target: "Destino",
		noTarget: "Sin destino específico",
		reasonCode: "Código del motivo",
		requestId: `${verbatimTerms.id.value} de solicitud`,
		traceId: `${verbatimTerms.id.value} de rastreo`,
		rawDetails: "Detalles estructurados",
	},
} satisfies typeof import("../zh-Hant/console").default;
