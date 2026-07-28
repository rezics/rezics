import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

const content = {
	meta: {
		title: `Contactar con ${verbatimTerms.rezics.value}`,
		description: `Contacta con la persona responsable de ${verbatimTerms.rezics.value} para hablar sobre contribuciones y colaboración.`,
	},
	eyebrow: "Contacto",
	title: "Ayuda a construir una infraestructura de contenido abierta",
	introduction:
		"Si quieres contribuir, informar de un problema o hablar sobre una colaboración, puedes contactar con nosotros a través de los canales siguientes.",
	role: "Responsable del proyecto",
	emailLabel: "Correo electrónico",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;

export default content;
