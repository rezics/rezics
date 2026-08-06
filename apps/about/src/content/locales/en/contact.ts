import { verbatimTerms } from "@rezics/i18n/verbatim-terms";

import type { ContactCopy } from "../contract";

const BRAND = verbatimTerms.rezics.value;
const GITHUB = verbatimTerms.github.value;
const MAINTAINER = verbatimTerms.edgeCoordinates.value;
const MAINTAINER_EMAIL = verbatimTerms.edgeCoordinatesEmail.value;

export const enContactCopy = {
	meta: {
		title: `Contact us — ${BRAND}`,
		description: `Talk with the ${BRAND} maintainer about product collaboration, open-source participation, the content model, and other ideas.`,
	},
	hero: {
		title: "Contact us",
		description:
			"Whether you want to bring a new kind of story, help build open source, or point out something that could be better, we would like to hear from you.",
	},
	topicsTitle: "A few places to start",
	topics: [
		{
			title: "Product and content collaboration",
			body: `Discuss how publishers, creators, communities, or content tools can connect their works, structures, and histories with ${BRAND}.`,
		},
		{
			title: "Open-source participation",
			body: "Help improve the code, documentation, design, research, and community so open content infrastructure can be genuinely useful.",
		},
		{
			title: "Questions and suggestions",
			body: "Report a problem, or tell us which product boundaries, data relationships, or user journeys are still unclear.",
		},
	],
	maintainer: {
		title: "Contact the project maintainer directly",
		description:
			"Please briefly share your background, what you would like to discuss, and how you would like us to respond.",
		name: MAINTAINER,
		role: "Project maintainer",
		emailLabel: "Email",
		email: MAINTAINER_EMAIL,
		githubLabel: GITHUB,
		sendEmail: "Send email",
	},
} satisfies ContactCopy;
