/**
 * A Meilisearch filter that has crossed a search-owned proof boundary.
 *
 * Callers cannot construct this nominal type directly. The two factories are
 * deliberately source-specific: access filters are derived from authoritative
 * authorization context, while domain filters are emitted by the conservative
 * Unit-predicate compiler.
 */
export class CandidateFilterClause {
	readonly #candidateFilterClause = true;
	readonly signature: string;

	private constructor(value: string) {
		this.signature = value;
	}

	get value(): string {
		if (!this.#candidateFilterClause) throw new TypeError("Invalid candidate filter proof");
		return this.signature;
	}

	static fromAccessPolicy(value: string): CandidateFilterClause {
		return new CandidateFilterClause(value);
	}

	static fromDomainSuperset(value: string): CandidateFilterClause {
		return new CandidateFilterClause(value);
	}
}
