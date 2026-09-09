import {
	assertSearchFeatureInput,
	type SearchFeatureInput,
	type SearchSort,
	type UnitPredicate,
} from "@rezics/filter";
import { fixtureId, type Configuration } from "./config";

export interface QueryCase {
	id: string;
	shape: string;
	bucket: "hot" | "rare";
	pages: number;
	path: string;
	body: SearchFeatureInput;
}

/** Native Filter grammar coverage, independent of keywords and provider samples. */
export function queryCases(config: Configuration): QueryCase[] {
	const cases: QueryCase[] = [];
	for (const bucket of ["hot", "rare"] as const) {
		const entity = fixtureId(2, bucket === "hot" ? 0 : 1);
		const otherEntity = fixtureId(2, 3);
		const realm = fixtureId(3, bucket === "hot" ? 0 : 1);
		const tag = fixtureId(4, bucket === "hot" ? 0 : 1);
		const credit: UnitPredicate = { creditAttributions: { some: { id: { in: [entity] } } } };
		const subject: UnitPredicate = { subjectAssociations: { some: { id: { in: [entity] } } } };
		const tagged: UnitPredicate = { tags: { some: { tag: { id: { in: [tag] } } } } };
		const placed: UnitPredicate = {
			realms: { some: { realm: { id: { in: [realm] } }, status: { in: ["visible"] } } },
		};
		const score: UnitPredicate = {
			scores: {
				received: { some: { realm: { id: { in: [realm] } }, value: { range: { minimum: 7 } } } },
			},
		};
		const shapes: Record<string, UnitPredicate> = {
			list: {},
			"credit-some": credit,
			"credit-none": { creditAttributions: { none: { id: { in: [entity] } } } },
			"subject-some": subject,
			"subject-none": { subjectAssociations: { none: { id: { in: [entity] } } } },
			"realm-some": placed,
			"realm-none": { realms: { none: { realm: { id: { in: [realm] } } } } },
			"tag-some": tagged,
			"tag-none": { tags: { none: { tag: { id: { in: [tag] } } } } },
			"score-nested": score,
			"score-none": {
				scores: {
					received: { none: { realm: { id: { in: [realm] } }, value: { range: { minimum: 7 } } } },
				},
			},
			"and-correlated": { all: [credit, subject] },
			"and-disjoint": {
				all: [credit, { subjectAssociations: { some: { id: { in: [otherEntity] } } } }],
			},
			"and-hot-rare": {
				all: [credit, { creditAttributions: { some: { id: { in: [fixtureId(2, 1)] } } } }],
			},
			"and-rare-hot": {
				all: [{ creditAttributions: { some: { id: { in: [fixtureId(2, 1)] } } } }, credit],
			},
			"or-indexed": { any: [credit, subject] },
			"or-unseeded": { any: [credit, { localizations: { some: { language: { in: ["en"] } } } }] },
			"not-and": { not: { all: [credit, subject] } },
			"and-or-not": { all: [placed, { any: [credit, subject] }, { not: tagged }] },
			"star-relations": { all: [placed, tagged, credit, score] },
			"nested-realm-predicate": {
				realms: {
					some: {
						any: [
							{ realm: { id: { in: [realm] } } },
							{
								all: [
									{ status: { in: ["visible"] } },
									{ not: { publicationState: { in: ["withdrawn"] } } },
								],
							},
						],
					},
				},
			},
		};
		const sorts: SearchSort[] = ["updatedAt:desc", "createdAt:asc"];
		for (const [shape, predicate] of Object.entries(shapes))
			for (const sort of sorts) {
				const id = `${shape}.${bucket}.${sort.replace(":", "-")}`;
				const body: SearchFeatureInput = {
					filterDocument: {
						categories: ["units"],
						where: {
							owner: { in: ["publishing"] },
							shape: { in: ["work"] },
							...(Object.keys(predicate).length ? { all: [predicate] } : {}),
						},
					},
					contexts: [],
					injections: [],
					state: { sort, pageSize: 20 },
				};
				assertSearchFeatureInput(body);
				cases.push({
					id,
					shape,
					bucket,
					pages: shape === "list" || shape === "and-or-not" ? 5 : 1,
					path: "/api/v1/search/filter/execute",
					body,
				});
			}
	}
	// These are deliberately secondary to the relation-only matrix.
	for (const query of ["capacitycommon", "capacityneedle"]) {
		const body: SearchFeatureInput = {
			filterDocument: { categories: ["units"], where: { owner: { in: ["publishing"] } } },
			contexts: [],
			injections: [],
			state: { filter: { search: { query } }, sort: "relevance", pageSize: 20 },
		};
		assertSearchFeatureInput(body);
		cases.push({
			id: `text.${query}`,
			shape: "text",
			bucket: query === "capacitycommon" ? "hot" : "rare",
			pages: 2,
			path: "/api/v1/search/filter/execute",
			body,
		});
	}
	const selected = cases.filter((item) => item.id.includes(config.casePattern));
	if (!selected.length) throw new Error("The case filter selected no workloads");
	return selected;
}
