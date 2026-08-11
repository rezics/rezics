export default {
	title: "Historial de revisiones",
	description:
		"Consulta los cambios, compara revisiones o restaura contenido cuando tengas permiso.",
	noRevisions: "Todavía no hay revisiones.",
	currentRevision: "Revisión actual",
	minorEdit: "Edición menor",
	hiddenRevision: "Oculta",
	undoRevision: "Deshacer esta edición",
	restoreRevision: "Restaurar esta revisión",
	compareWithParent: "Comparar con la anterior",
	revisionBy: "Editor",
	noEditSummary: "Sin resumen de la edición",
	compareTitle: "Diferencia entre revisiones",
	before: "Antes",
	after: "Después",
	backToHistory: "Volver al historial de revisiones",
	backToEditor: "Volver al editor",
	bytes: "bytes",
	visibility: {
		hiddenBadge: "Oculta",
		suppressedBadge: "Acceso restringido",
		protectedSummary: "Resumen de la edición protegido",
		manage: "Gestionar visibilidad",
		title: "Gestionar la visibilidad de la revisión",
		description:
			"Restringe el acceso al contenido, al resumen de la edición o a la identidad del editor. Todos los cambios quedan auditados.",
		copyrightPreset: "Aplicar protección de derechos de autor",
		copyrightPresetDescription:
			"Oculta el contenido y el resumen para que solo puedan verlos quienes tengan acceso de supresión.",
		levelLabel: "Nivel de protección",
		levels: {
			visible: "Visible",
			hidden: "Oculta a los lectores",
			suppressed: "Solo supresores",
		},
		levelDescriptions: {
			visible: "Cualquiera que pueda leer esta Unit puede ver la revisión.",
			hidden:
				"Solo quienes tengan acceso de moderación de la plataforma pueden ver los datos seleccionados.",
			suppressed: "Solo quienes tengan acceso de supresión pueden ver los datos seleccionados.",
		},
		fieldsLabel: "Datos protegidos",
		fields: {
			content: "Contenido de la revisión",
			summary: "Resumen de la edición",
			actor: "Identidad del editor",
		},
		currentRevisionContent:
			"No se puede ocultar el contenido de la revisión actual. Publica primero una revisión limpia y protege después la anterior.",
		reasonLabel: "Motivo",
		selectReason: "Selecciona un motivo",
		atLeastOneField: "Selecciona al menos un dato que proteger.",
		cancel: "Cancelar",
		save: "Guardar visibilidad",
	},
	structureKinds: {
		create: "Estructura creada",
		update: "Estructura actualizada",
		delete: "Estructura eliminada",
		restore: "Estructura restaurada",
	},
} satisfies typeof import("../zh-Hant/history").default;
