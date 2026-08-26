export const TerminologyLocaleValues = [
	"en",
	"zh-Hant",
	"zh-Hans",
	"de",
	"fr",
	"es",
	"ja",
	"ko",
] as const;

export type TerminologyLocale = (typeof TerminologyLocaleValues)[number];

type TerminologyConceptDefinition<
	Slots extends readonly string[],
	Locales extends readonly TerminologyLocale[],
> = {
	readonly definition: string;
	readonly slots: Slots;
	readonly locales: Locales;
};

function defineTerminologyConcepts<
	const Concepts extends Record<
		string,
		TerminologyConceptDefinition<readonly string[], readonly TerminologyLocale[]>
	>,
>(concepts: Concepts): Concepts {
	return concepts;
}

const AllTerminologyLocales = TerminologyLocaleValues;
const WebTerminologyLocales = AllTerminologyLocales;

/**
 * Stable REZICS product concepts whose user-visible names must remain
 * consistent across product surfaces. Keys identify concepts, not source words.
 */
export const terminologyConcepts = defineTerminologyConcepts({
	follow: {
		definition:
			"A person's ongoing interest relationship with a Unit; this is not a content subscription or notification-delivery contract.",
		slots: [
			"actionLabel",
			"action",
			"stateLabel",
			"gerund",
			"followed",
			"undoActionLabel",
			"undoAction",
			"follower",
			"collectionLabel",
		] as const,
		locales: WebTerminologyLocales,
	},
	zone: {
		definition: "The REZICS Zone product concept.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: AllTerminologyLocales,
	},
	realm: {
		definition: "The REZICS Realm product concept.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: AllTerminologyLocales,
	},
	dock: {
		definition: "The REZICS Dock content-placement concept.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	unitSlug: {
		definition:
			"The optional human-facing path identifier of a Unit; slug remains the internal code and API identifier.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	post: {
		definition:
			"The REZICS Post product concept; this does not refer to the HTTP POST method or every Post subtype label.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: AllTerminologyLocales,
	},
	video: {
		definition:
			"A top-level timed visual-media Unit that can be placed in a Media content structure.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	audio: {
		definition: "A top-level timed audio Unit that can be placed in a Media content structure.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	label: {
		definition:
			"A lightweight localized-title Unit used as a structural heading or taxonomy entry; this is distinct from an assignable Tag.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	tagPath: {
		definition:
			"A community-immutable, community-voted ordered path of Tags; platform administrators may make audited corrections.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	license: {
		definition:
			"A registered legal instrument or rights statement that a Unit grants independently of every other selected License.",
		slots: ["label", "inline"] as const,
		locales: WebTerminologyLocales,
	},
	entity: {
		definition:
			"A Unit representing a person, organization, or character that can participate in attributions and subject associations.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	metadata: {
		definition:
			"Structured administrative and type-specific information about a Unit, distinct from its localized editorial content.",
		slots: ["label", "inline"] as const,
		locales: WebTerminologyLocales,
	},
});

export type TerminologyConceptKey = keyof typeof terminologyConcepts;

export type TerminologyConceptKeyForLocale<Locale extends TerminologyLocale> = {
	[Concept in TerminologyConceptKey]: Locale extends (typeof terminologyConcepts)[Concept]["locales"][number]
		? Concept
		: never;
}[TerminologyConceptKey];

type TerminologyForms<Concept extends TerminologyConceptKey> = Readonly<
	Record<(typeof terminologyConcepts)[Concept]["slots"][number], string>
>;

export type LocalizedTerminologyEntry<Concept extends TerminologyConceptKey> = {
	readonly status: "approved";
	readonly forms: TerminologyForms<Concept>;
	readonly forbidden: readonly string[];
	readonly note?: string;
};

export type TerminologyForLocale<Locale extends TerminologyLocale> = {
	readonly [Concept in TerminologyConceptKeyForLocale<Locale>]: LocalizedTerminologyEntry<Concept>;
};

export function defineTerminology<const Locale extends TerminologyLocale>(
	_locale: Locale,
	terminology: TerminologyForLocale<Locale>,
): TerminologyForLocale<Locale> {
	return terminology;
}
