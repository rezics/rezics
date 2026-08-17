import type { FeedFixtureLocalizedContent } from "../../content-feed/localized-content";

export default {
	attributions: [
		{
			name: "Dolphin Reading Club",
			initials: "D",
			summary: "A reading group for speculative fiction, criticism, and shared annotations.",
		},
		{
			name: "Lena Mori",
			initials: "L",
			summary: "Writes about networked minds and the social life of fictional worlds.",
		},
		{
			name: "Archive Signals",
			initials: "A",
			summary: "A collaborative profile for research notes and source trails.",
		},
	],
	realms: [
		{
			name: "Archive Atlas",
			initials: "X",
			summary: "Discussion of a fictional series, its setting, characters, and ideas.",
		},
		{
			name: "Collective Intelligence",
			initials: "C",
			summary: "How groups coordinate knowledge, judgment, and action.",
		},
		{
			name: "Science Fiction Studies",
			initials: "S",
			summary: "Close readings of science fiction across media and traditions.",
		},
	],
	post: {
		title: "Why is the Lattice Network the setting's most unusual group mind?",
		body: "The Lattice Network is more than a sum of individual minds. Its electromagnetic medium crosses the limits of personal ability while preserving differences between individuals.",
		mediaAlt: "A night skyline crossed by luminous network paths",
	},
	collection: {
		title: "Where science and story meet",
		body: "A collection of chapters, reviews, and worldbuilding notes worth revisiting.",
		coverAlt: "An abstract blue and amber book cover",
	},
} satisfies FeedFixtureLocalizedContent;
