import type { FeedFixtureLocalizedContent } from "../../content-feed/localized-content";

export default {
	attributions: [
		{
			name: "Cercle de lecture du Dauphin",
			initials: "D",
			summary:
				"Un groupe consacré aux littératures de l'imaginaire, à la critique et aux annotations partagées.",
		},
		{
			name: "Lena Mori",
			initials: "L",
			summary: "Écrit sur les consciences en réseau et la vie sociale des mondes de fiction.",
		},
		{
			name: "Signaux d'archives",
			initials: "A",
			summary:
				"Un profil collaboratif réunissant notes de recherche, sources et pistes de lecture.",
		},
	],
	realms: [
		{
			name: "A Certain Magical Index",
			initials: "I",
			summary:
				"Discussions sur l'univers, les personnages, l'intrigue et les idées de la série.",
		},
		{
			name: "Intelligence collective",
			initials: "I",
			summary: "Comment les groupes coordonnent connaissances, jugements et actions.",
		},
		{
			name: "Études de science-fiction",
			initials: "S",
			summary:
				"Lectures approfondies de la science-fiction à travers les médias et les traditions.",
		},
	],
	post: {
		title: "Pourquoi le réseau Misaka est-il la conscience collective la plus singulière d'Academy City ?",
		body: "Le réseau Misaka dépasse la simple somme des esprits individuels. Son support électromagnétique franchit les limites des capacités personnelles tout en préservant les différences entre chaque individu.",
		mediaAlt: "Une ville de nuit traversée par des lignes de réseau lumineuses",
	},
	collection: {
		title: "Là où la science rencontre la magie",
		body: "Une collection de chapitres, de critiques et de notes sur l'univers qui méritent d'être relus.",
		coverAlt: "Une couverture abstraite aux tons bleus et ambrés",
	},
} satisfies FeedFixtureLocalizedContent;
