import { describe, expect, it } from "vitest";

import { compileCandidateDomainFilter } from "./candidate-domain";

describe("candidate domain filter", () => {
	it("pushes the Work Zone union into the candidate index", () => {
		const filter = compileCandidateDomainFilter({
			any: [
				{ kind: { in: ["media"] } },
				{ post: { is: { subject: { is: { kind: { in: ["media"] } } } } } },
				{
					collection: {
						is: { items: { some: { kind: { in: ["media"] } } } },
					},
				},
			],
		});

		expect(filter?.value).toBe(
			'(unitType IN ["media"] OR (filters.postExists = true AND filters.subjectUnitKind IN ["media"]) OR (filters.collectionExists = true AND filters.collectionItemUnitKinds IN ["media"]))',
		);
	});

	it("keeps a supported necessary condition from an implicit conjunction", () => {
		const filter = compileCandidateDomainFilter({
			kind: { in: ["book"] },
			localizations: { some: { language: { in: ["zh"] } } },
		});

		expect(filter?.value).toBe('unitType IN ["book"]');
	});

	it("omits an unsafe disjunction when one branch has no candidate proof", () => {
		const filter = compileCandidateDomainFilter({
			any: [
				{ kind: { in: ["book"] } },
				{ localizations: { some: { language: { in: ["zh"] } } } },
			],
		});

		expect(filter).toBeUndefined();
	});

	it("omits an unsafe negation of a partial predicate", () => {
		const filter = compileCandidateDomainFilter({
			not: {
				kind: { in: ["book"] },
				localizations: { some: { language: { in: ["zh"] } } },
			},
		});

		expect(filter).toBeUndefined();
	});

	it("does not turn a collection item ID exclusion into a kind exclusion", () => {
		const filter = compileCandidateDomainFilter({
			collection: {
				is: {
					items: {
						none: {
							id: { in: ["0198e6bd-18ff-7760-b9cc-4f74f8bb29bf"] },
							kind: { in: ["media"] },
						},
					},
				},
			},
		});

		expect(filter?.value).toBe("filters.collectionExists = true");
	});
});
