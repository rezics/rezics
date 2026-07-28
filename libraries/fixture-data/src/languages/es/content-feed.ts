import type { FeedFixtureLocalizedContent } from "../../content-feed/localized-content";

export default {
	attributions: [
		{
			name: "Club de lectura Delfín",
			initials: "D",
			summary:
				"Una comunidad dedicada a la ficción especulativa, la crítica y las anotaciones compartidas.",
		},
		{
			name: "Lena Mori",
			initials: "L",
			summary: "Escribe sobre mentes conectadas y la vida social de los mundos de ficción.",
		},
		{
			name: "Señales de archivo",
			initials: "A",
			summary:
				"Un perfil colaborativo para notas de investigación, fuentes y recorridos de lectura.",
		},
	],
	realms: [
		{
			name: "A Certain Magical Index",
			initials: "I",
			summary:
				"Conversaciones sobre el mundo, los personajes, la trama y las ideas de la serie.",
		},
		{
			name: "Inteligencia colectiva",
			initials: "I",
			summary: "Cómo coordinan los grupos el conocimiento, el juicio y la acción.",
		},
		{
			name: "Estudios de ciencia ficción",
			initials: "C",
			summary:
				"Lecturas detalladas de ciencia ficción a través de distintos medios y tradiciones.",
		},
	],
	post: {
		title: "¿Por qué la Red Misaka es la mente colectiva más singular de Ciudad Academia?",
		body: "La Red Misaka es más que la suma de varias mentes individuales. Su medio electromagnético supera los límites de las capacidades personales sin borrar las diferencias entre cada individuo.",
		mediaAlt: "Una ciudad nocturna atravesada por rutas luminosas de red",
	},
	collection: {
		title: "Donde se encuentran la ciencia y la magia",
		body: "Una colección de capítulos, reseñas y notas sobre el mundo ficticio que vale la pena releer.",
		coverAlt: "Una cubierta abstracta en tonos azules y ámbar",
	},
} satisfies FeedFixtureLocalizedContent;
