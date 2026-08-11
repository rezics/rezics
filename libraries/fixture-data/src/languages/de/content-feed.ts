import type { FeedFixtureLocalizedContent } from "../../content-feed/localized-content";

export default {
	attributions: [
		{
			name: "Lesekreis Delfin",
			initials: "D",
			summary: "Eine Lesegemeinschaft für spekulative Literatur, Kritik und gemeinsame Notizen.",
		},
		{
			name: "Lena Mori",
			initials: "L",
			summary: "Schreibt über vernetzte Bewusstseine und das soziale Leben fiktiver Welten.",
		},
		{
			name: "Archivsignale",
			initials: "A",
			summary: "Ein Gemeinschaftsprofil für Forschungsnotizen, Quellen und Lesespuren.",
		},
	],
	realms: [
		{
			name: "A Certain Magical Index",
			initials: "I",
			summary: "Gespräche über die Welt, Figuren, Handlung und Ideen der Reihe.",
		},
		{
			name: "Kollektive Intelligenz",
			initials: "K",
			summary: "Wie Gruppen Wissen, Urteile und gemeinsames Handeln koordinieren.",
		},
		{
			name: "Science-Fiction-Forschung",
			initials: "S",
			summary: "Genaue Lektüren von Science-Fiction aus verschiedenen Medien und Traditionen.",
		},
	],
	post: {
		title: "Warum ist das Misaka-Netzwerk das ungewöhnlichste Gruppenbewusstsein von Academy City?",
		body: "Das Misaka-Netzwerk ist mehr als die Summe einzelner Bewusstseine. Sein elektromagnetisches Medium überschreitet die Grenzen persönlicher Fähigkeiten und bewahrt zugleich die Unterschiede zwischen den Einzelnen.",
		mediaAlt: "Nächtliche Stadtsilhouette mit leuchtenden Netzwerkpfaden",
	},
	collection: {
		title: "Wo Wissenschaft und Magie aufeinandertreffen",
		body: "Eine Sammlung von Kapiteln, Rezensionen und Notizen zum Weltenbau, die eine erneute Lektüre lohnen.",
		coverAlt: "Abstrakter Buchumschlag in Blau und Bernstein",
	},
} satisfies FeedFixtureLocalizedContent;
