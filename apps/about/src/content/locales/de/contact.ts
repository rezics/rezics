import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

export default {
	meta: {
		title: `${verbatimTerms.rezics.value} kontaktieren`,
		description: `Kontaktiere die Projektbetreuung von ${verbatimTerms.rezics.value}, um über Mitwirkung und Zusammenarbeit zu sprechen.`,
	},
	eyebrow: "Kontakt",
	title: "Offene Inhaltsinfrastruktur gemeinsam gestalten",
	introduction:
		"Wenn du mitentwickeln, ein Problem melden oder eine Zusammenarbeit besprechen möchtest, erreichst du uns über die folgenden Kanäle.",
	role: "Projektbetreuung",
	emailLabel: "E-Mail",
	githubLabel: verbatimTerms.github.value,
} satisfies typeof import("../en/contact").default;
