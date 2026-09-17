import {
	BundleSchema,
	type TermLabel,
	type VocabularyBundle,
	type VocabularyRelease,
	type VocabularyTerm,
} from "./contracts";
import { digest, schemaId, stableJson, termId } from "./identity";

/** @alpha Bounded vocabulary lookup for backend label hydration and schema tools. */
export class VocabularyRegistry {
	readonly bundle: VocabularyBundle;
	private readonly byId = new Map<string, VocabularyTerm>();
	private readonly byIri = new Map<string, VocabularyTerm>();
	private readonly ordered: VocabularyTerm[];

	constructor(input: unknown) {
		this.bundle = BundleSchema.parse(input);
		const { id, digest: hash, ...body } = this.bundle;
		if (hash !== digest(stableJson(body)) || id !== schemaId("bundle", hash))
			throw new TypeError("Bundle identity or digest mismatch");
		for (const term of this.bundle.terms) {
			if (term.id !== termId(term.iri) || this.byId.has(term.id))
				throw new TypeError("Duplicate or invalid term identity");
			this.byId.set(term.id, term);
			for (const iri of [term.iri, ...term.aliases]) {
				if (this.byIri.has(iri)) throw new TypeError("Conflicting IRI identity");
				this.byIri.set(iri, term);
			}
		}
		const keys = new Set<string>();
		for (const release of this.bundle.releases) {
			if (keys.has(release.source.key)) throw new TypeError("Duplicate selected vocabulary");
			keys.add(release.source.key);
			for (const definition of release.definitions)
				if (!this.byId.has(definition.termId) || definition.vocabularyId !== release.vocabularyId)
					throw new TypeError("Invalid definition reference");
			for (const label of release.labels)
				if (!this.byId.has(label.termId)) throw new TypeError("Invalid label reference");
		}
		this.ordered = [...this.byId.values()].sort((a, b) =>
			a.iri < b.iri ? -1 : a.iri > b.iri ? 1 : 0,
		);
	}

	/** Resolve a UUID or exact IRI, including only registered aliases. */
	term(reference: string): VocabularyTerm {
		const term = this.byId.get(reference) ?? this.byIri.get(reference);
		if (!term) throw new TypeError(`Unknown vocabulary term: ${reference}`);
		return term;
	}

	/** Pin the origin when using meaning; an external assertion is not automatically another vocabulary's definition. */
	definition(reference: string, vocabulary: string) {
		const term = this.term(reference),
			release = this.release(vocabulary);
		const definition = release.definitions.find((candidate) => candidate.termId === term.id);
		if (!definition) throw new TypeError(`Term has no definition in ${vocabulary}: ${term.iri}`);
		return definition;
	}

	/** Get the explicitly selected release in this immutable bundle. */
	release(key: string): VocabularyRelease {
		const release = this.bundle.releases.find((candidate) => candidate.source.key === key);
		if (!release) throw new TypeError(`Vocabulary is not selected: ${key}`);
		return release;
	}

	/** Return all contributed definitions and labels; frontend text never determines identity. */
	describe(reference: string, language = "en") {
		const term = this.term(reference);
		const contributions = this.bundle.releases.flatMap((release) => {
			const definition = release.definitions.find((candidate) => candidate.termId === term.id);
			if (!definition) return [];
			const labels = release.labels.filter((candidate) => candidate.termId === term.id);
			return [
				{
					vocabulary: release.source.key,
					releaseId: release.id,
					definition,
					labels,
					label: preferredLabel(labels, language),
				},
			];
		});
		return { ...term, contributions, external: contributions.length === 0 };
	}

	/** Keyset pages are bound to a bundle, so upgrades cannot silently mix generations. */
	page(
		input: { limit?: number; namespace?: string; after?: { bundleId: string; iri: string } } = {},
	) {
		const limit = input.limit ?? 50;
		if (!Number.isInteger(limit) || limit < 1 || limit > 200)
			throw new RangeError("Page limit must be 1..200");
		if (input.after && input.after.bundleId !== this.bundle.id)
			throw new TypeError("Vocabulary cursor belongs to another bundle");
		const matches = this.ordered.filter(
			(term) =>
				(!input.namespace || term.iri.startsWith(input.namespace)) &&
				(!input.after || term.iri > input.after.iri),
		);
		const items = matches.slice(0, limit),
			last = items.at(-1);
		return {
			items,
			after: matches.length > limit && last ? { bundleId: this.bundle.id, iri: last.iri } : null,
		};
	}
}

/** @alpha Deterministic display fallback; all original language tags and alternatives remain available. */
export function preferredLabel(labels: readonly TermLabel[], language: string): TermLabel | null {
	const tag = language.toLowerCase(),
		base = tag.split("-")[0]!;
	const preference = (label: TermLabel) => {
		const candidate = label.language.toLowerCase();
		const locale =
			candidate === tag
				? 0
				: candidate === base
					? 1
					: candidate === "en"
						? 2
						: candidate === ""
							? 3
							: 4;
		const kind = label.predicate.endsWith("#prefLabel")
			? 0
			: label.predicate.endsWith("#label")
				? 1
				: label.predicate.endsWith("#hiddenLabel")
					? 3
					: 2;
		return locale * 10 + kind;
	};
	return (
		[...labels].sort((a, b) => preference(a) - preference(b) || a.id.localeCompare(b.id))[0] ?? null
	);
}

/** @alpha Compare meaning and label changes separately; missing terms are not automatically deleted or retired. */
export function diffVocabularies(before: VocabularyBundle, after: VocabularyBundle) {
	const entries = (bundle: VocabularyBundle) =>
		new Map(
			bundle.releases.flatMap((release) =>
				release.definitions.map(
					(definition) =>
						[
							`${release.vocabularyId}/${definition.termId}`,
							{
								vocabulary: release.source.key,
								termId: definition.termId,
								definitionId: definition.id,
								labels: release.labels
									.filter((label) => label.termId === definition.termId)
									.map((label) => label.id)
									.sort()
									.join(","),
							},
						] as const,
				),
			),
		);
	const previous = entries(new VocabularyRegistry(before).bundle),
		next = entries(new VocabularyRegistry(after).bundle);
	const changes: {
		vocabulary: string;
		termId: string;
		kind: "added" | "removed" | "meaning" | "labels";
	}[] = [];
	for (const [key, value] of next) {
		const old = previous.get(key);
		if (!old) changes.push({ vocabulary: value.vocabulary, termId: value.termId, kind: "added" });
		else {
			if (old.definitionId !== value.definitionId)
				changes.push({ vocabulary: value.vocabulary, termId: value.termId, kind: "meaning" });
			if (old.labels !== value.labels)
				changes.push({ vocabulary: value.vocabulary, termId: value.termId, kind: "labels" });
		}
	}
	for (const [key, value] of previous)
		if (!next.has(key))
			changes.push({ vocabulary: value.vocabulary, termId: value.termId, kind: "removed" });
	return changes;
}
