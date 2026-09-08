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
	publisher: {
		definition:
			"A person or organization credited with issuing published content, including a bibliographic publication or a platform post.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	publishingWork: {
		definition: "A written intellectual work, independent of its text versions and publications.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	textVersion: {
		definition:
			"One identifiable text, translation or revision that can be embodied by publications.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	publication: {
		definition:
			"One bibliographic publication or edition, independent of its covered texts or works.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	serialization: {
		definition: "An identifiable ongoing or completed serialized publication of content.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	publishingCoverage: {
		definition: "The known extent of a work or text included in another publishing resource.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	publishingInstallment: {
		definition: "One ordered installment of serialized content; not necessarily a chapter.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	chapter: {
		definition: "One authored chapter in a text reading structure.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	program: {
		definition:
			"An audiovisual screen work, including film, television and animation; separate from its versions and episodes.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	softwareContent: {
		definition: "A software intellectual work or title, independent of versions and releases.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	softwareVersion: {
		definition: "An evidenced version of a software title with a declared distinction.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	softwareRelease: {
		definition: "One concrete software release, separate from its included contents and versions.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	grouping: {
		definition:
			"A catalog grouping such as a series, franchise or continuity; not a user Collection or membership organization.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	referenceConcept: {
		definition: "A catalog reference concept; distinct from an indexable Tag.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	distributionPackage: {
		definition:
			"One distributed package or manifest that can include independently identified resources.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	publishingCatalog: {
		definition: "The catalog family containing written works, text versions and publications.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	software: {
		definition: "The catalog family of software titles, versions and releases.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	referenceCatalog: {
		definition: "The catalog family of reference concepts, places, instruments and events.",
		slots: ["label", "pluralLabel", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	music: {
		definition: "The native music domain.",
		slots: ["label", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	musicRecording: {
		definition: "One recorded performance, distinct from a printed track occurrence.",
		slots: ["label", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	musicTrack: {
		definition: "One printed track occurrence on one release medium.",
		slots: ["label", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	musicMedium: {
		definition: "One ordered physical or digital carrier in a music release.",
		slots: ["label", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	musicRelease: {
		definition: "One concrete music release with its own carrier and track structure.",
		slots: ["label", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
	musicReleaseGroup: {
		definition: "A family of related music releases.",
		slots: ["label", "inline", "plural"] as const,
		locales: WebTerminologyLocales,
	},
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
	customTheme: {
		definition:
			"A reusable full-trust Unit presentation package; distinct from a Zone's built-in appearance settings.",
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
		slots: [
			"label",
			"pluralLabel",
			"inline",
			"plural",
			"personLabel",
			"organizationLabel",
			"characterLabel",
		] as const,
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
