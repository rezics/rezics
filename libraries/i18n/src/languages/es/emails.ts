import { insert } from "native-i18n";

import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	layout: {
		automatedMessage: "Este es un mensaje automático. No respondas a este correo electrónico.",
		copyright: insert(
			`© {{year}} ${verbatimTerms.rezics.value}. Todos los derechos reservados.`,
			{
				year: Number,
			},
		),
	},
	resetPassword: {
		subject: `Restablece tu contraseña de ${verbatimTerms.rezics.value}`,
		preview: `Restablece tu contraseña de ${verbatimTerms.rezics.value}`,
		heading: "Restablece tu contraseña",
		body: "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Utiliza el botón de abajo durante la próxima hora para elegir una contraseña nueva.",
		actionLabel: "Restablecer contraseña",
		fallback: "Si el botón no funciona, abre este enlace:",
		ignoreNotice:
			"Si no has hecho esta solicitud, puedes ignorar este correo. Tu contraseña no cambiará.",
	},
	verifyEmail: {
		subject: `Verifica tu correo electrónico de ${verbatimTerms.rezics.value}`,
		preview: `Verifica tu correo electrónico de ${verbatimTerms.rezics.value}`,
		heading: "Verifica tu correo electrónico",
		body: "Confirma que esta dirección de correo te pertenece para terminar de configurar tu cuenta.",
		actionLabel: "Verificar correo electrónico",
		fallback: "Si el botón no funciona, abre este enlace:",
		ignoreNotice:
			"Si no has creado una cuenta ni solicitado esta verificación, puedes ignorar este correo.",
	},
} satisfies typeof import("../zh-Hant/emails").default;
