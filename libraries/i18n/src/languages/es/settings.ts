import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: realmTerms } = esTerminology.realm;
const { forms: customThemeTerms } = esTerminology.customTheme;
const { forms: unitSlugTerms } = esTerminology.unitSlug;
const { forms: licenseTerms } = esTerminology.license;
const { forms: metadataTerms } = esTerminology.metadata;
const { forms: postTerms } = esTerminology.post;
const { forms: zoneTerms } = esTerminology.zone;

export default {
	workspace: {
		title: "Configuración",
		description: `Gestiona tu perfil, preferencias, fuentes de etiquetas, seguridad de la cuenta y tokens de ${verbatimTerms.api.value}.`,
		backToApplication: "Volver a la aplicación",
		backToOverview: "Volver a la configuración",
		navigation: "Navegación de configuración",
		overview: "Toda la configuración",
		sections: {
			profile: {
				label: "Perfil",
				description:
					"Actualiza tu nombre público, presentación, imagen de perfil, banner y dirección del perfil.",
			},
			preferences: {
				label: "Preferencias",
				description: `Elige los idiomas de la interfaz y del contenido, las clasificaciones, un ${realmTerms.inline} de puntuación predeterminado y una ${esTerminology.license.forms.inline} predeterminada.`,
			},
			privacy: {
				label: "Privacidad",
				description: "Controla si otras personas pueden ver tus puntuaciones y tu progreso.",
			},
			tagSources: {
				label: "Fuentes de etiquetas",
				description: `Elige y ordena los ${realmTerms.plural} cuyas valoraciones de etiquetas quieras ver.`,
			},
			account: {
				label: "Cuenta",
				description: "Revisa la información de la cuenta y gestiona tu inicio de sesión actual.",
			},
			security: {
				label: "Seguridad",
				description: "Cambia tu contraseña y gestiona los dispositivos con sesión iniciada.",
			},
			tokens: {
				label: `Tokens de ${verbatimTerms.api.value}`,
				description:
					"Crea, limita, deshabilita y revoca tokens de acceso para herramientas de automatización.",
			},
		},
	},
	privacy: {
		title: "Privacidad",
		description: "Define el límite general de visibilidad de tus puntuaciones y progreso actual.",
		scoreTitle: "Puntuaciones",
		scoreDescription:
			"Limita si otras personas pueden ver tus puntuaciones en tu perfil o en reseñas relacionadas.",
		progressTitle: "Progreso",
		progressDescription:
			"Limita si otras personas pueden ver tu progreso actual en tu perfil o en reseñas relacionadas.",
		categoryRule:
			"Este ajuste general es un límite de visibilidad y no modifica los registros individuales. Al hacerlo privado, los elementos públicos se ocultan temporalmente; al volver a público, reaparecen.",
		unlistedRule: `Los elementos no listados no aparecen en tu perfil, pero pueden mostrarse en una reseña o ${postTerms.inline} que enlaces expresamente. Los privados solo son visibles para ti.`,
	},
	profile: "Perfil",
	slugAddress: unitSlugTerms.label,
	slugAddressHint: `Usa entre 1 y 63 letras ${verbatimTerms.ascii.value} minúsculas, números o guiones. Después de un cambio, la ${verbatimTerms.url.value} anterior redirige de forma permanente a la nueva ${verbatimTerms.url.value}.`,
	profileSlugAddressHint: `Elige con cuidado: actualmente solo puedes definir esta dirección una vez y no podrás cambiarla después. Usa entre 1 y 63 letras ${verbatimTerms.ascii.value} minúsculas, números o guiones. Los nombres reservados por la plataforma no están disponibles.`,
	profileSlugAddressAssignedHint:
		"Esta dirección de perfil ya está definida y actualmente no se puede cambiar.",
	profileSlugReserved: "Esta dirección de perfil está reservada y no se puede utilizar.",
	preferences: "Preferencias",
	interfaceLanguage: "Idioma de la interfaz",
	contentLanguage: "Idioma de contenido preferido",
	contentLanguages: "Idiomas de contenido preferidos",
	contentLanguagesHint:
		"Arrastra los idiomas para cambiar su orden. El contenido usa este orden, después el idioma de la interfaz y, por último, el orden de idiomas propio de la Unit.",
	addContentLanguage: "Añadir idioma",
	dragContentLanguage: insert("Arrastrar {{language}} para cambiar su orden", {
		language: String,
	}),
	moveContentLanguageUp: insert("Subir {{language}}", { language: String }),
	moveContentLanguageDown: insert("Bajar {{language}}", { language: String }),
	removeContentLanguage: insert("Quitar {{language}}", { language: String }),
	filterFeedByPreferredLanguages: "Filtrar las novedades por idiomas preferidos",
	filterFeedByPreferredLanguagesHint:
		"Cuando esta opción está activada, las novedades solo incluyen contenido disponible en al menos un idioma preferido. Las demás listas siguen mostrando todo el contenido coincidente con sustitución de idioma.",
	alwaysShowSpoilers: "Mostrar siempre los destripes",
	alwaysShowSpoilersHint: "Mostrar el contenido marcado como destripe sin revelarlo uno por uno.",
	alwaysShowNsfw: `Mostrar siempre el contenido ${verbatimTerms.nsfw.value}`,
	alwaysShowNsfwHint: `Mostrar los medios marcados como ${verbatimTerms.nsfw.value} sin desenfocarlos primero.`,
	customThemes: `Mostrar ${customThemeTerms.plural} de las ${zoneTerms.plural}`,
	customThemesHint: `Si desactivas esta opción, todas las ${zoneTerms.plural} usarán el tema predeterminado de la plataforma. El contenido y el diseño no cambian.`,
	account: "Cuenta",
	accountDescription: "Gestiona la sesión iniciada actualmente.",
	security: "Seguridad",
	securityDescription:
		"Cambia la contraseña de tu cuenta. También puedes cerrar sesión en otros dispositivos.",
	currentPassword: "Contraseña actual",
	newPassword: "Nueva contraseña",
	revokeOtherSessions: "Cerrar sesión en otros dispositivos después de cambiar la contraseña",
	passwordChanged: "Tu contraseña se ha cambiado.",
	sessions: "Dispositivos con sesión iniciada",
	sessionsDescription: "Revoca las sesiones que ya no uses o reconozcas.",
	currentSession: "Dispositivo actual",
	unknownDevice: "Dispositivo desconocido",
	unknownAddress: "Dirección desconocida",
	lastUpdated: "Actividad reciente",
	sessionExpires: "Vence",
	revokeSession: "Cerrar sesión en este dispositivo",
	tokens: {
		title: `Tokens de ${verbatimTerms.api.value}`,
		description:
			"Crea credenciales de automatización con el menor acceso necesario y límites específicos para cada token.",
		securityWarningTitle: `Protege tus tokens de ${verbatimTerms.api.value}`,
		securityWarning:
			"Trata los tokens como contraseñas: no los compartas ni los guardes en el control de versiones. Concede solo los permisos necesarios y define una caducidad adecuada. Si un token puede haber quedado expuesto, revócalo y sustitúyelo de inmediato.",
		securityGuide: "Ver la guía de uso",
		createTitle: "Crear token",
		createDescription:
			"El secreto se muestra una sola vez. Empieza eligiendo el menor acceso necesario y límites prudentes.",
		name: "Nombre",
		namePlaceholder: `Por ejemplo: agente de cumplimentación de ${metadataTerms.inline} de libros`,
		expiresIn: "Duración",
		expiryDays: {
			thirty: "30 días",
			ninety: "90 días",
			year: "365 días",
		},
		permissions: "Permisos",
		permissionsDescription:
			"Concede solo las operaciones necesarias para la tarea. Selecciona al menos una.",
		selectContentAgent: "Seleccionar valores predeterminados para agentes de contenido",
		selectReadOnly: "Seleccionar valores predeterminados de solo lectura",
		permissionsRequired: "Selecciona al menos un permiso.",
		matrix: {
			templates: "Plantillas de permisos",
			searchPlaceholder: "Buscar grupos de permisos…",
			clear: "Anular toda la selección",
			selected: insert("{{selected}} / {{total}} seleccionados", {
				selected: Number,
				total: Number,
			}),
			categorySelected: insert("{{selected}} seleccionados", { selected: Number }),
			required: "Obligatorio",
			empty: "Ningún permiso coincide con la búsqueda.",
		},
		permissionCategories: {
			content: "Contenido y colaboración",
			identity: "Identidad y perfil",
			communication: "Comunicación",
			platform: "Plataforma",
		},
		permissionResources: {
			unit: "Units",
			profile: "Perfil",
			interaction: "Interacciones",
			realm: realmTerms.label,
			message: "Mensajes",
			notification: "Notificaciones",
			recommendation: "Recomendaciones",
			upload: "Subidas",
			report: "Denuncias",
		},
		permissionActions: {
			read: "Leer",
			create: "Crear",
			update: "Actualizar",
			write: "Escribir",
			manage: "Gestionar",
		},
		permissionLabels: {
			unitRead: "Leer Units y contenido",
			unitCreate: "Crear Units",
			unitUpdate: "Actualizar Units y traducciones",
			profileRead: "Leer perfiles públicos",
			profileUpdate: "Actualizar el perfil",
			interactionRead: "Leer interacciones",
			interactionWrite: "Crear interacciones",
			realmRead: `Leer ${realmTerms.plural}`,
			realmManage: `Gestionar ${realmTerms.plural}`,
			messageRead: "Leer mensajes",
			messageWrite: "Enviar mensajes",
			notificationRead: "Leer notificaciones",
			notificationWrite: "Actualizar el estado de las notificaciones",
			recommendationRead: "Leer recomendaciones",
			recommendationWrite: "Enviar interacciones de recomendación",
			uploadRead: "Leer subidas",
			uploadWrite: "Crear subidas",
			reportWrite: "Enviar denuncias",
		},
		limits: "Límites de uso",
		standardLimitsDescription: `Cada token tiene su propia política de plataforma y también comparte la cuota de la cuenta. Tu protección opcional solo puede reducir la capacidad del token; asignar acceso ${verbatimTerms.privilegedApiQuotaClass.value} requiere autoridad de plataforma.`,
		limitsDescription:
			"Las cuotas deben mantenerse dentro de los intervalos permitidos por la política actual. Los límites globales y específicos de una operación se aplican conjuntamente.",
		limitRanges: insert(
			"Intervalos permitidos: de {{requestsMinimum}} a {{requestsMaximum}} solicitudes por minuto; capacidad de ráfaga de {{burstMinimum}} a {{burstMaximum}}; de {{concurrentMinimum}} a {{concurrentMaximum}} solicitudes simultáneas; de {{dailyMinimum}} a {{dailyMaximum}} unidades de coste diarias.",
			{
				requestsMinimum: String,
				requestsMaximum: String,
				burstMinimum: String,
				burstMaximum: String,
				concurrentMinimum: String,
				concurrentMaximum: String,
				dailyMinimum: String,
				dailyMaximum: String,
			},
		),
		limitRangePlaceholder: insert("Intervalo: {{minimum}}–{{maximum}}", {
			minimum: String,
			maximum: String,
		}),
		limitRangeError: insert("Introduce un número entero entre {{minimum}} y {{maximum}}.", {
			minimum: String,
			maximum: String,
		}),
		requestsPerMinute: "Solicitudes por minuto",
		burstCapacity: "Capacidad de ráfaga",
		maxConcurrentRequests: "Solicitudes simultáneas",
		dailyCostUnits: "Unidades de coste diarias",
		create: "Crear token",
		createdTitle: "Guarda el nuevo token ahora",
		createdDescription:
			"No podrás volver a verlo después de cerrar este aviso. Revoca y sustituye cualquier token perdido.",
		copyToken: "Copiar token",
		dismissSecret: "Lo he guardado de forma segura",
		listTitle: "Tokens existentes",
		listDescription:
			"Revisa su uso periódicamente y revoca los tokens en cuanto dejen de ser necesarios.",
		empty: `Todavía no se ha creado ningún token de ${verbatimTerms.api.value}.`,
		enabled: "Habilitado",
		disabled: "Deshabilitado",
		prefix: "Prefijo identificativo",
		expires: "Vence",
		lastUsed: "Último uso",
		neverUsed: "Nunca usado",
		policy: "Política",
		standardPolicy: "Estándar",
		privilegedPolicy: verbatimTerms.privilegedApiQuotaClass.value,
		trustedFallback: "Sustitución Estándar activa",
		trustedUntil: "El acceso con mayor frecuencia vence",
		manageAccess: "Gestionar nombre y acceso",
		configureLimits: "Configurar límites",
		hideEditor: "Cerrar configuración",
		saveAccess: "Guardar nombre y acceso",
		enable: "Habilitar",
		disable: "Deshabilitar",
		revoke: "Revocar",
		revokeTitle: "¿Revocar permanentemente este token?",
		revokeDescription:
			"Todas las automatizaciones que usen este token perderán el acceso de inmediato. Esta acción no se puede deshacer.",
		cancel: "Cancelar",
		saveLimits: "Guardar límites",
		operationOverrides: "Límites específicos de una operación",
		operationOverridesDescription: `Usa el ${verbatimTerms.apiPolicyOperationId.value} del documento ${verbatimTerms.openapi.value} para definir un límite específico para una operación. Los límites globales siguen aplicándose.`,
		operationId: `${verbatimTerms.id.value} de operación`,
		operationIdPlaceholder: `Pega un ${verbatimTerms.id.value} de operación`,
		operations: {
			"search.execute": "Ejecutar búsqueda",
			"image.upload": "Subir imágenes",
		},
		addOperation: "Añadir límite de operación",
		removeOperation: "Quitar",
		invalidLimits:
			"Revisa los valores de los límites, los identificadores de operación y los duplicados.",
		resetLimits: "Quitar límites específicos del token",
	},
	defaultLicense: `${licenseTerms.label} predeterminada`,
	defaultLicenses: `${licenseTerms.label} predeterminadas`,
	defaultScoreRealm: `${realmTerms.label} de puntuación predeterminado`,
	defaultScoreRealmHint: `Las puntuaciones de las páginas generales se guardan en este ${realmTerms.inline}. Las creadas en otro ${realmTerms.inline} permanecen allí.`,
	general: "General",
	realmManageMode: `Crear ${realmTerms.plural} en modo de gestión de forma predeterminada`,
	on: "Activado",
	off: "Desactivado",
} satisfies typeof import("../zh-Hant/settings").default;
