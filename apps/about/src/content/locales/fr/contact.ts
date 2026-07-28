import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	meta: {
		title: `Contacter ${verbatimTerms.rezics.value}`,
		description: `Contactez l’équipe de maintenance de ${verbatimTerms.rezics.value} pour contribuer ou envisager une collaboration.`,
	},
	eyebrow: "Nous contacter",
	title: "Contribuez à une infrastructure de contenu ouverte",
	introduction:
		"Si vous souhaitez contribuer, signaler un problème ou discuter d’une collaboration, vous pouvez nous joindre par les canaux ci-dessous.",
	role: "Équipe de maintenance du projet",
	emailLabel: "E-mail",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;
