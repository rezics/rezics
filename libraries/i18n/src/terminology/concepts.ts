export const TerminologyLocaleValues = ["en", "zh-Hant", "zh-Hans", "de", "ja", "ko"] as const;

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
const WebTerminologyLocales = ["en", "zh-Hant"] as const satisfies readonly TerminologyLocale[];

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
});

export type TerminologyConceptKey = keyof typeof terminologyConcepts;

export type TerminologyConceptKeyForLocale<Locale extends TerminologyLocale> = {
	[
		Concept in TerminologyConceptKey
	]: Locale extends (typeof terminologyConcepts)[Concept]["locales"][number] ? Concept : never;
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
	readonly [
		Concept in TerminologyConceptKeyForLocale<Locale>
	]: LocalizedTerminologyEntry<Concept>;
};

export function defineTerminology<const Locale extends TerminologyLocale>(
	_locale: Locale,
	terminology: TerminologyForLocale<Locale>,
): TerminologyForLocale<Locale> {
	return terminology;
}
