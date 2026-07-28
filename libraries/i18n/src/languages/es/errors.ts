import { insert } from "native-i18n";

export default {
	unknown: "Se ha producido un error inesperado.",
	unknownWithCode: insert("Se ha producido un error inesperado ({{code}}).", {
		code: String,
	}),
	unauthorized: "Inicia sesión para continuar.",
	forbidden: "No tienes permiso para realizar esta acción.",
	notFound: "No se encontró este contenido.",
	conflict: "Este contenido ha cambiado. Actualiza la página y vuelve a intentarlo.",
	invalid: "El contenido enviado no es válido.",
	unavailable: "El servicio no está disponible temporalmente. Vuelve a intentarlo más tarde.",
} satisfies typeof import("../zh-Hant/errors").default;
