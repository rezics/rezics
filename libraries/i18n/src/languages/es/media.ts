import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { insert } from "native-i18n";

const SupportedImageFormats = `${verbatimTerms.jpeg.value}, ${verbatimTerms.png.value}, ${verbatimTerms.webp.value} o ${verbatimTerms.avif.value}`;

export default {
	choose: "Elige, arrastra o pega una imagen",
	hint: `${SupportedImageFormats}, hasta 10 ${verbatimTerms.mib.value}`,
	replace: "Reemplazar",
	remove: "Eliminar",
	cancel: "Cancelar",
	invalid: `Elige una imagen ${SupportedImageFormats} de menos de 10 ${verbatimTerms.mib.value}.`,
	current: "Sustitución para el idioma actual",
	displayPreview: "Área mostrada",
	editPresentation: "Ajustar el área mostrada",
	localizationFallback: {
		notice: "Cada recurso de imagen aplica la sustitución de idioma de forma independiente.",
		title: "Sustitución de idioma para imágenes",
		description:
			"El avatar, el banner y la portada se resuelven por separado del idioma elegido para el texto.",
		viewerPreferences:
			"Las imágenes se buscan según las preferencias de idioma de cada persona. Si un idioma no contiene esa imagen, se omite y la búsqueda continúa con el siguiente idioma preferido.",
		defaultOrder:
			"Si ninguno de los idiomas preferidos contiene la imagen, la búsqueda continúa según el orden de localización predeterminado del contenido.",
		noImage:
			"Si ninguna localización contiene la imagen, no se devuelve una imagen localizada.",
		textDifference:
			"El texto sigue una regla distinta: se elige una localización completa y el título, el resumen y la descripción no se sustituyen campo por campo desde idiomas diferentes.",
		example:
			"Por ejemplo, si una persona prefiere chino y después inglés, el chino contiene el texto y el banner, pero no el avatar, y el inglés contiene un avatar, verá el texto y el banner en chino junto con el avatar en inglés.",
		close: "Cerrar las reglas de sustitución de idioma para imágenes",
	},
	presentationEditor: {
		title: {
			avatar: "Ajustar avatar",
			banner: "Ajustar banner",
			cover: "Ajustar portada",
		},
		description: {
			avatar: "Arrastra y amplía la imagen dentro del recorte cuadrado. La vista previa circular del avatar no elimina las esquinas originales.",
			banner: "Arrastra y amplía la imagen dentro del recorte fijo 4:1. Los banners nuevos comienzan en la esquina superior izquierda.",
			cover: "Mantén la imagen completa de forma predeterminada o cambia a un recorte fijo 3:4 cuando la composición sea más importante.",
		},
		close: "Cerrar el ajuste de imagen",
		loading: "Cargando la imagen original…",
		loadFailed: "No se pudo cargar la imagen original o su presentación.",
		cropArea:
			"Área de recorte de la imagen. Arrastra para cambiar su posición, usa la rueda del ratón para ampliar o las teclas de flecha para moverla.",
		zoom: "Ampliación",
		zoomIn: "Ampliar",
		zoomOut: "Reducir",
		reset: "Restablecer",
		avatarPreview: "Vista previa circular",
		bannerPreview: "Vista previa del banner",
		coverPreview: "Vista previa de la portada completa",
		coverMode: {
			label: "Modo de visualización de la portada",
			contain: "Mostrar imagen completa",
			crop: "Recortar a 3:4",
			containDescription:
				"La imagen completa permanece visible. El marco utiliza un fondo desenfocado cuando sus proporciones son distintas.",
			cropDescription: "Solo se entrega y muestra el área 3:4 seleccionada.",
		},
		cancel: "Cancelar",
		save: "Guardar el área mostrada",
		saveFailed: "No se pudo guardar el área mostrada. Vuelve a intentarlo.",
	},
	avatarPicker: {
		setup: "Configurar avatar",
		edit: "Editar avatar",
		dialogTitle: "Elegir un avatar",
		dialogDescription: "Sube una imagen o elige un icono o emoji.",
		close: "Cerrar el selector de avatar",
		source: "Origen del avatar",
		useInherited: "Usar avatar heredado",
		recent: "Usados recientemente",
		typeLabel: "Tipo de avatar",
		tabs: { image: "Imagen", icon: "Icono", emoji: "Emoji" },
		preview: "Vista previa del avatar",
		icon: {
			search: "Buscar iconos",
			featured: "Iconos habituales",
			style: "Estilo del icono",
			styles: { fas: "Sólido", fab: "Marcas" },
			loading: "Buscando iconos…",
			empty: "No se encontraron iconos que coincidan.",
			failed: "Ahora mismo no se pueden buscar iconos. Vuelve a intentarlo más tarde.",
			select: insert("Seleccionar icono: {{name}}", { name: String }),
			unconfigured: `${verbatimTerms.fontAwesome.value} ${verbatimTerms.cdn.value} no está configurado, por lo que no se pueden mostrar vistas previas de los iconos.`,
		},
		emoji: {
			search: "Buscar emojis",
			skinTone: "Cambiar tono de piel",
			loading: "Cargando emojis…",
			empty: "No se encontraron emojis que coincidan.",
		},
	},
	bannerPreview: {
		description: "El banner entregado utiliza el área 4:1 guardada.",
		showOriginal: "Ver imagen completa",
		hideOriginal: "Ocultar imagen completa",
		original: "Imagen completa",
	},
	roles: {
		avatar: {
			title: "Avatar",
			inherit: "Usar el primer avatar disponible según el orden de idiomas",
			failed: "No se pudo subir el avatar. Vuelve a intentarlo.",
		},
		banner: {
			title: "Banner",
			inherit: "Usar el primer banner disponible según el orden de idiomas",
			failed: "No se pudo subir el banner. Vuelve a intentarlo.",
		},
		cover: {
			title: "Portada",
			inherit: "Usar la primera portada disponible según el orden de idiomas",
			failed: "No se pudo subir la portada. Vuelve a intentarlo.",
		},
	},
} satisfies typeof import("../zh-Hant/media").default;
