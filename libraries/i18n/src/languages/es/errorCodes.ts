import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { esTerminology } from "@rezics/i18n/terminology/es";

const { forms: dockTerms } = esTerminology.dock;
const { forms: followTerms } = esTerminology.follow;
const { forms: postTerms } = esTerminology.post;
const { forms: realmTerms } = esTerminology.realm;
const { forms: tagStructureTerms } = esTerminology.tagStructure;
const { forms: unitSlugTerms } = esTerminology.unitSlug;
const { forms: zoneTerms } = esTerminology.zone;
const { forms: entityTerms } = esTerminology.entity;

export default {
	MalformedRequestBody: "No se ha podido leer el contenido enviado.",
	ValidationError: "El contenido enviado no es válido.",
	InternalError: "El servicio no está disponible temporalmente. Inténtalo de nuevo más tarde.",
	AuthenticationRequired: "Inicia sesión para continuar.",
	ApiTokenPermissionRequired: `Este token de ${verbatimTerms.api.value} no tiene el permiso necesario.`,
	ApiTokenRateLimitExceeded: `Este token de ${verbatimTerms.api.value} está enviando solicitudes demasiado rápido. Vuelve a intentarlo en unos instantes.`,
	ApiQuotaExceeded: `Se agotó la cuota de ${verbatimTerms.api.value}. Vuelve a intentarlo después del tiempo indicado.`,
	ApiQuotaPolicyNotFound: `No se encontró la política de cuotas de ${verbatimTerms.api.value} solicitada.`,
	ApiQuotaPolicyKeyConflict: `Ya existe una política de cuotas de ${verbatimTerms.api.value} con esta clave.`,
	ApiQuotaPolicyInvalid: `La configuración de la política de cuotas de ${verbatimTerms.api.value} no es válida.`,
	ApiQuotaPolicyRevisionConflict: `La política de cuotas de ${verbatimTerms.api.value} cambió. Vuelve a cargarla antes de guardar.`,
	ApiAccountQuotaRevisionConflict: `La cuota de ${verbatimTerms.api.value} de la cuenta cambió. Vuelve a cargarla antes de guardar.`,
	ApiTokenQuotaRevisionConflict: `La asignación de cuota del token de ${verbatimTerms.api.value} cambió. Vuelve a cargarla antes de guardar.`,
	ApiTokenLimitReached: `Esta cuenta alcanzó el límite de tokens de ${verbatimTerms.api.value}.`,
	ApiTokenQuotaOverrideInvalid: `La anulación de cuota del token de ${verbatimTerms.api.value} no es válida.`,
	ApiTokenQuotaOverrideRevisionConflict: `La anulación de cuota del token de ${verbatimTerms.api.value} cambió. Vuelve a cargarla antes de guardar.`,
	InteractiveSessionRequired: "Inicia una sesión interactiva para gestionar las credenciales.",
	FreshSessionRequired:
		"Vuelve a iniciar sesión antes de realizar una acción administrativa sensible.",
	EmailVerificationRequired: "Verifica tu correo electrónico para continuar.",
	AccountSuspended: "Esta cuenta está suspendida.",
	AccountClosed: "Esta cuenta está cerrada.",
	UserAccountStateRevisionConflict:
		"El estado de la cuenta ha cambiado. Recarga e inténtalo de nuevo.",
	UserSelfStatusChangeForbidden: "No puedes suspender ni cerrar tu propia cuenta.",
	PlatformUserManagerRequired:
		"La plataforma debe conservar al menos un gestor de usuarios activo.",
	UserAccountStateExpiryInvalid: "El fin de la suspensión debe ser posterior a la hora actual.",
	SessionNotFound: "No se ha encontrado esta sesión.",
	AccountRestricted: "Esta cuenta tiene restringida esa acción.",
	UnitNotFound: "No se ha encontrado este contenido.",
	UnitPermissionForbidden: "No tienes el permiso necesario para este contenido.",
	UnitAccessRestricted: "Tu acceso a este perímetro de contenido está restringido.",
	UnitContentLicenseGrantForbidden: `Solo las obras de propiedad personal pueden conceder una licencia a ${verbatimTerms.rezics.value}.`,
	UnitChanged: "Este contenido ha cambiado. Actualiza la página e inténtalo de nuevo.",
	UnitRevisionConflict:
		"La versión de referencia ha cambiado. Actualiza la página e inténtalo de nuevo.",
	ContentStructureRevisionConflict:
		"La estructura de contenido se ha modificado en otro lugar. Actualiza la página e inténtalo de nuevo.",
	CollectionStructureRevisionConflict:
		"La estructura de los elementos se ha modificado en otro lugar. Actualiza la página e inténtalo de nuevo.",
	DockRevisionConflict: `La ${dockTerms.inline} se ha modificado en otro lugar. Actualiza la página e inténtalo de nuevo.`,
	DockNotFound: `No se ha encontrado esta ${dockTerms.inline}.`,
	DockNotSupported: `Este contenido no admite esa ${dockTerms.inline}.`,
	DockDocumentInvalid: `El documento de la ${dockTerms.inline} no es válido.`,
	ApiTokenNotFound: `No se ha encontrado el token de ${verbatimTerms.api.value} activo.`,
	InvalidSearch: "La solicitud de búsqueda no es válida.",
	SearchUnavailable:
		"La búsqueda no está disponible temporalmente. Inténtalo de nuevo más tarde.",
	RealmCapabilityRequired: `No tienes el permiso necesario para el ${realmTerms.inline}.`,
	RealmRulesAcceptanceRequired: `Acepta las reglas actuales del ${realmTerms.inline} para continuar.`,
	RealmRuleRevisionChanged:
		"Las reglas cambiaron en el servidor. Revisa la última versión e inténtalo de nuevo.",
	PlatformCapabilityRequired: "Esta acción requiere un permiso de plataforma.",
	PlatformAccessManagerRequired:
		"La plataforma debe conservar al menos un administrador de acceso sin vencimiento.",
	PlatformAccessRevisionConflict:
		"El acceso a la plataforma se ha modificado en otro lugar. Vuelve a cargarlo antes de intentarlo de nuevo.",
	PlatformAccessConfigurationInvalid: "Cada capacidad de plataforma solo puede aparecer una vez.",
	CollectionOwnershipRequired: "Esta colección no te pertenece.",
	ProfileNotFound: "No se ha encontrado este perfil.",
	ProfileChanged: "Este perfil ha cambiado. Actualiza la página e inténtalo de nuevo.",
	PreferencesNotFound: "No se han encontrado estas preferencias.",
	UserNotFound: "No se ha encontrado este usuario.",
	UserSelfFollowForbidden: `No puedes ${followTerms.action}te a ti mismo.`,
	UserFollowBlocked: `${followTerms.stateLabel} no está disponible entre usuarios bloqueados.`,
	FollowingTargetKindMismatch: `El tipo de la Unit ${followTerms.followed} ha cambiado. Vuelve a cargar sus ajustes.`,
	UserSelfBlockForbidden: "No puedes bloquearte a ti mismo.",
	SoftwareSystemRequirementSourceInvalid:
		"El origen del requisito del sistema debe pertenecer a este software.",
	SeriesReleaseNotFound: "No se ha encontrado esta versión de la serie.",
	ZonePageNotFound: `No se ha encontrado esta página de ${zoneTerms.inline}.`,
	ZonePageInUse: `Esta página de ${zoneTerms.inline} todavía se usa en un documento de bloques o navegación.`,
	ZoneNavigationNotFound: `No se ha encontrado esta navegación de ${zoneTerms.inline}.`,
	ZoneNavigationInUse: `Esta navegación de ${zoneTerms.inline} todavía se usa en un documento de bloques.`,
	ZoneDocumentInvalid: `El documento de bloques o navegación de la ${zoneTerms.inline} no es válido.`,
	ZoneTimeRangeInvalid: `La hora de finalización de la ${zoneTerms.inline} debe ser posterior a la de inicio.`,
	SoftwareNotFound: "No se ha encontrado este software.",
	SystemRequirementNotFound: "No se ha encontrado este requisito del sistema.",
	PollOptionsDuplicated: "Las opciones de la encuesta deben ser únicas.",
	PollNotFound: "No se ha encontrado esta encuesta.",
	PollClosed: "Esta encuesta está cerrada.",
	PollSingleChoiceInvalid: "Elige exactamente una opción para esta encuesta.",
	PollOptionInvalid: "La opción de encuesta seleccionada no es válida.",
	PollAlreadyClosed: "Esta encuesta ya está cerrada.",
	ContentStructureInvalid: "Esta estructura de contenido no cumple las reglas de su finalidad.",
	ContentStructureNotFound: "No se ha encontrado esta estructura de contenido.",
	ContentStructureNodeNotFound: "No se ha encontrado este nodo de la estructura de contenido.",
	ReviewNotFound: "No se ha encontrado esta reseña.",
	ContentGovernanceTargetNotFound: "No se ha encontrado el destino de moderación.",
	ContentReviewRealmMissing: `Falta el ${realmTerms.inline} en este caso de moderación.`,
	ContentReviewCaseNotFound: "No se ha encontrado este caso de moderación.",
	ContentGovernanceReversedActionInvalid: "La acción revertida no pertenece a este caso.",
	ContentGovernanceActionIncompatible:
		"Esta acción no está disponible para el destino de moderación.",
	ContentGovernanceTransitionInvalid:
		"El destino no puede realizar esa transición de estado de moderación.",
	ContentGovernanceActionNoEffect: "La acción de moderación no modificaría el destino.",
	ContentGovernanceReversalUnavailable: "Ya no se puede revertir esta acción de forma segura.",
	ContentGovernanceIdempotencyConflict:
		"Esta clave de reintento ya se ha usado para otra solicitud de moderación.",
	GovernanceNoteRoleDuplicate: "Añade como máximo una nota interna y un aviso público.",
	ReportAlreadySubmitted: "Ya has denunciado esta unidad para el caso activo.",
	ReportTargetRevisionUnavailable:
		"Esta unidad no tiene ninguna revisión que se pueda denunciar.",
	ReportRuleUnavailable: "El alcance de gobernanza seleccionado no tiene reglas vigentes.",
	ReportRuleChanged:
		"La regla seleccionada ha cambiado. Vuelve a elegir una regla antes de enviar.",
	ReportRuleSourceForbidden: `Las denuncias solo pueden citar las reglas del ${realmTerms.inline} actual y las reglas oficiales.`,
	ContentGovernanceRuleSourceForbidden:
		"La regla seleccionada está fuera de esta autoridad de gobernanza de contenido.",
	ContentGovernanceRuleChanged:
		"Una regla seleccionada ya no pertenece a la revisión vigente. Vuelve a seleccionarla.",
	EnforcementExpiryInvalid: "El vencimiento de la medida debe estar en el futuro.",
	EnforcementNotFound: "No se ha encontrado esta medida.",
	EnforcementAlreadyRevoked: "Esta medida ya se ha revocado.",
	EnforcementChanged: "Esta medida ha cambiado. Actualiza la página e inténtalo de nuevo.",
	RealmMemberNotFound: `No se ha encontrado este miembro activo del ${realmTerms.inline}.`,
	CapabilityGrantExpiryInvalid: "El vencimiento de la concesión debe estar en el futuro.",
	CapabilityGrantNotFound: "No se ha encontrado esta concesión activa de capacidad.",
	UnitAccessExpiryInvalid: "El vencimiento del acceso a la Unit debe estar en el futuro.",
	UnitAccessInvitationNotFound: "No se ha encontrado esta invitación de acceso a una Unit.",
	UnitAccessInvitationConflict:
		"Ya no se puede responder a esta invitación de acceso a una Unit.",
	UnitAccessInvitationExpired: "Esta invitación de acceso a una Unit ha vencido.",
	UnitAccessInvitationSelfForbidden: "No puedes invitarte a ti mismo a una Unit.",
	UnitOwnerRestrictionForbidden: "No se puede restringir al propietario de una Unit.",
	UnitAccessConfigurationInvalid:
		"Esta configuración de acceso a la Unit no es válida o supera los permisos que puedes delegar.",
	UnitOwnershipChanged: "El propietario de la Unit ha cambiado. Recarga e inténtalo de nuevo.",
	UnitOwnershipTargetIneligible:
		"El perfil seleccionado ya no puede recibir la propiedad de la Unit.",
	UnitOwnershipRelinquishmentForbidden:
		"No se puede renunciar a la propiedad de una Unit de la comunidad.",
	UnitOwnershipOverrideConfirmationInvalid:
		"El identificador de Unit introducido no coincide con el destino de la reasignación.",
	UnitOwnershipClaimUnavailable:
		"Solo se puede reclamar la titularidad de Units públicas compatibles que aún pertenezcan a la comunidad.",
	UnitOwnershipClaimAlreadyPending:
		"Ya tienes una reclamación de titularidad pendiente para esta Unit.",
	UnitOwnershipClaimNotFound: "No se ha encontrado esta reclamación de titularidad de Unit.",
	UnitOwnershipClaimChanged:
		"La reclamación o la titularidad de origen ha cambiado. Recarga e inténtalo de nuevo.",
	UnitOwnershipClaimConfirmationInvalid:
		"El identificador de reclamación introducido no coincide con el destino de la revisión.",
	UnitOwnershipClaimSelfDecisionForbidden:
		"El solicitante no puede revisar su propia reclamación de titularidad.",
	UnitLifecycleConfirmationInvalid:
		"El identificador de Unit introducido no coincide con el destino.",
	UnitLifecycleChanged: "La Unit ha cambiado. Recarga e inténtalo de nuevo.",
	UnitLifecycleProtected: "Esta Unit protegida no se puede eliminar provisionalmente.",
	UnitAlreadyDeleted: "Esta Unit ya está eliminada provisionalmente.",
	UnitNotDeleted: "Esta Unit no está eliminada provisionalmente.",
	InvalidPaginationCursor: "Este enlace de página no es válido o ha vencido.",
	BookNotFound: "No se ha encontrado este libro.",
	MediaNotFound: "No se ha encontrado este elemento multimedia.",
	ChapterNotFound: "No se ha encontrado este capítulo.",
	ChapterLanguageNotFound: "No se ha encontrado este idioma del capítulo.",
	ReportRealmMismatch: `La unidad denunciada no pertenece a este ${realmTerms.inline}.`,
	PostNotFound: `No se ha encontrado esta ${postTerms.inline}.`,
	PostLocalizationNotFound: `No se ha encontrado esta versión lingüística de la ${postTerms.inline}.`,
	PostTargetingLocked: `Este destino no acepta nuevas ${postTerms.plural}.`,
	ReplyPostNotFound: `No se ha encontrado esta ${postTerms.inline} de respuesta.`,
	ParentReplyNotFound: `No se ha encontrado la ${postTerms.inline} de respuesta superior en esta conversación.`,
	ReplyDepthExceeded: "Esta respuesta superaría la profundidad máxima de la conversación.",
	InvalidNotificationCursor: "Este enlace de página de notificaciones no es válido o ha vencido.",
	NotificationNotFound: "No se ha encontrado esta notificación.",
	EntityEntryNotFound: `No se ha encontrado esta entrada de ${entityTerms.inline}.`,
	EntityAssociationRestricted: `Esta ${entityTerms.inline} no acepta ese tipo de asociación.`,
	AssociationProposalNotFound: "No se ha encontrado esta propuesta de asociación.",
	AssociationProposalConflict: "Ya no se puede responder a esta propuesta de asociación.",
	AssociationProposalExpired: "Esta propuesta de asociación ha vencido.",
	AssociationProposalExpiryInvalid:
		"El vencimiento de la propuesta de asociación debe estar en el futuro.",
	AssociationProposalRoleInvalid:
		"La función de asociación seleccionada no coincide con el tipo de asociación.",
	CreditAttributionNotFound: "No se ha encontrado esta atribución de crédito.",
	CreditAttributionRoleInvalid:
		"La función de crédito seleccionada no corresponde a este tipo de Unit.",
	CreditAttributionRequestConfirmationRequired:
		"Confirma antes de enviar las invitaciones de crédito.",
	SubjectAssociationNotFound: "No se ha encontrado esta asociación de tema.",
	AliasNotFound: "No se ha encontrado este alias.",
	TagApplicationNotFound: "No se ha encontrado esta aplicación de etiqueta.",
	UnitTagCurationChanged:
		"Esta selección de etiquetas se ha modificado en otro lugar. Se ha cargado el orden más reciente; inténtalo de nuevo.",
	TagNotFound: "No se ha encontrado esta etiqueta.",
	UnitExternalLinkNotFound: "No se ha encontrado este enlace externo de la obra.",
	UnitReferenceCurationChanged:
		"La selección de referencias cambió en otro lugar. Se cargó el orden más reciente; inténtalo de nuevo.",
	UnitReferenceLimitReached: "Esta obra ya tiene el número máximo de referencias activas.",
	UnitReferencePinnedLimitReached: "Esta obra ya tiene el número máximo de referencias fijadas.",
	UnitReferenceWithdrawn: "Esta referencia se ha retirado.",
	UnitVariantKindMismatch:
		"Una variante y su elemento principal deben usar el mismo tipo de Unit compatible.",
	UnitVariantTargetIsVariant: "Una variante debe apuntar directamente a un elemento principal.",
	UnitVariantSourceHasVariants:
		"Un elemento principal con variantes no puede convertirse en una variante.",
	UnitVariantChanged:
		"La relación de la Unit con su elemento principal ha cambiado. Actualiza la página e inténtalo de nuevo.",
	UnitVariantMainUnavailable:
		"El elemento principal no está disponible para este estado de la variante.",
	InvalidMessageCursor: "Este enlace de página de mensajes no es válido o ha vencido.",
	ConversationNotFound: "No se ha encontrado esta conversación.",
	ConversationParticipantsInvalid: "Una conversación directa requiere dos usuarios.",
	DirectMessageBlocked: "La mensajería directa no está disponible entre estos usuarios.",
	MessageNotFound: "No se ha encontrado este mensaje.",
	CollectionNotFound: "No se ha encontrado esta colección.",
	RealmNotFound: `No se ha encontrado este ${realmTerms.inline}.`,
	RealmMembershipNotFound: `No se ha encontrado esta pertenencia al ${realmTerms.inline}.`,
	RealmOwnerLeaveForbidden: `El propietario del ${realmTerms.inline} no puede abandonarlo.`,
	RealmUnitNotFound: `Esta Unit no está incorporada al ${realmTerms.inline}.`,
	WikiNavigationNotFound: "No se ha encontrado esta navegación wiki.",
	WikiNavigationInUse: "Esta navegación wiki todavía está en uso.",
	WikiNavigationDocumentInvalid: "El documento de navegación wiki no es válido.",
	FavoritesEditForbidden: "La colección Favoritos no se puede editar.",
	FavoritesDeleteForbidden: "La colección Favoritos no se puede eliminar.",
	InvalidFeedCursor: "Este enlace de página de novedades no es válido o ha vencido.",
	InvalidFeedFilter: "Este filtro de novedades no es válido.",
	InvalidHistoryCursor: "Este enlace de página del historial no es válido o ha vencido.",
	UnitRevisionNotFound: "No se ha encontrado esta versión de la Unit.",
	CurrentRevisionContentVisibilityForbidden:
		"Restaura otra versión antes de ocultar el contenido de la versión actual.",
	ImageAssetNotFound: "No se ha encontrado este recurso de imagen.",
	ImageAssetUploadNotFound: "No se ha encontrado el objeto de imagen subido.",
	ImageAssetUnsupportedType: "Este formato de imagen no es compatible.",
	ImageAssetInvalidSize: "El tamaño de la imagen no es válido.",
	ImageAssetContentMismatch:
		"El contenido de la imagen no coincide con su declaración de subida.",
	ImageAssetInvalidState: "El estado del recurso de imagen no permite esta operación.",
	ImageAssetInvalidPresentation: "El área mostrada no es válida para esta imagen y función.",
	ImageAssetInUse: "No se puede eliminar un recurso de imagen que esté en uso.",
	UnitLocalizationOrderChanged:
		"El orden de los idiomas del contenido se ha modificado en otro lugar. Vuelve a cargarlo e inténtalo de nuevo.",
	UnitLocalizationOrderInvalid:
		"El orden de idiomas debe incluir exactamente una vez cada idioma de contenido existente.",
	UnitLocalizationNotFound: "Ese idioma del contenido ya no existe.",
	UnitLastLocalizationRemovalForbidden:
		"Una Unit debe conservar al menos un idioma de contenido.",
	InvalidSlug: `El ${unitSlugTerms.inline} debe ser una etiqueta ${verbatimTerms.ascii.value} en minúsculas, de entre 1 y 63 caracteres y separada por guiones.`,
	SlugTaken: `Ese ${unitSlugTerms.inline} ya se usa en este espacio de nombres de Unit.`,
	SlugReserved: `Ese ${unitSlugTerms.inline} está reservado y no se puede utilizar.`,
	ProfileSlugChangeUnavailable: `El ${unitSlugTerms.inline} de tu perfil no se puede cambiar actualmente después de definirlo.`,
	SlugScopeNotFound: `No se ha encontrado el espacio de nombres de Unit de este ${unitSlugTerms.inline}.`,
	SlugScopeUnavailable: `Las Units sin dirección y las eliminadas no pueden ser espacios de nombres canónicos de ${unitSlugTerms.plural}.`,
	SlugScopeCycle: `Este traslado crearía un ciclo en el espacio de nombres de ${unitSlugTerms.plural}.`,
	SlugDepthExceeded: `La ruta del ${unitSlugTerms.inline} de la Unit supera la profundidad máxima.`,
	UnitAddressMutationForbidden: `Esta dirección de ${unitSlugTerms.inline} de la Unit no permite realizar esa operación.`,
	SlugRedirectNotFound: `No se ha encontrado la redirección del ${unitSlugTerms.inline}.`,
	UnitSlugAddressNotFound: `La Unit no tiene ninguna dirección canónica con ${unitSlugTerms.inline}.`,
	GovernanceNoteNotFound: "No se ha encontrado esta nota de gobernanza.",
	PostScoreDuplicate: `Una ${postTerms.inline} no puede mostrar la misma puntuación más de una vez.`,
	PostScoreNotFound: "No se ha encontrado una puntuación seleccionada.",
	RealmScoreContextPostNotMounted: `La ${postTerms.inline} que sirve como contexto de puntuación debe estar incorporada al ${realmTerms.inline}.`,
	RealmScoreContextPostKindInvalid: `El contexto de puntuación debe usar una ${postTerms.inline} normal o un artículo wiki.`,
	RealmTagContextNotFound: `No se ha encontrado la explicación de esta etiqueta en el ${realmTerms.inline}.`,
	RealmTagContextPostNotMounted: `La ${postTerms.inline} usada como explicación de la etiqueta debe estar visible en el ${realmTerms.inline}.`,
	RealmTagContextAlreadyExists: `Este ${realmTerms.inline} ya tiene una explicación para esa etiqueta.`,
	RealmTagContextPostAlreadyUsed: `Esa ${postTerms.inline} ya explica otra etiqueta en un ${realmTerms.inline}.`,
	RealmTagVotingDisabled: `La votación de etiquetas no está activada en este ${realmTerms.inline}.`,
	RealmTagContextRequired: `Este ${realmTerms.inline} debe proporcionar primero una explicación formal y actualmente visible de la etiqueta.`,
	RealmTagSelfReferenceForbidden: "Una etiqueta no se puede aplicar a sí misma.",
	SearchDocumentRevisionConflict:
		"La configuración de búsqueda ha cambiado. Vuelve a cargarla antes de guardar.",
	ZoneSearchFeatureNotFound: `Esta ${zoneTerms.inline} no tiene ninguna función de búsqueda habilitada.`,
	SharedSearchQueryNotFound: "No se ha encontrado esta consulta de búsqueda compartida.",
	InvalidTagStructure: `Esta ${tagStructureTerms.inline} no es válida.`,
	TagStructureNotFound: `No se ha encontrado esta ${tagStructureTerms.inline}.`,
	TagStructureApplicationNotFound: `Esta Unit no tiene esa ${tagStructureTerms.inline}.`,
	TagStructureChanged: `Esta ${tagStructureTerms.inline} se ha modificado en otro lugar. Actualiza la página e inténtalo de nuevo.`,
	TagStructureDefinitionConflict: `Ya existe una ${tagStructureTerms.inline} idéntica.`,
	AssociationContextPostInvalid: `El contexto de la relación debe ser una ${postTerms.inline} de wiki.`,
	ProgressEntryNotFound: "No se ha encontrado este evento de progreso.",
	PostTagMentionVoteConflict: `Esta mención de etiqueta entra en conflicto con tu voto negativo actual en la ${postTerms.inline}.`,
	UnitRealmPublicationNotFound: `Este contenido no tiene una relación de inclusión con ese ${realmTerms.label}.`,
	UnitRealmPublicationAlreadyExists: `Este contenido ya tiene una relación de inclusión con ese ${realmTerms.label}.`,
	UnitRealmPublicationTransitionInvalid:
		"La relación de inclusión ya se encuentra en el estado solicitado.",
} satisfies typeof import("../zh-Hant/errorCodes").default;
