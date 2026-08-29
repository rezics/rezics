import { describe, expect, it } from "vitest";
import { rezicsTextLocales, rezicsTextMessages } from "./messages";

const representativeSyntax = [
	/^---$/mu,
	/^# /mu,
	/\*[^*]+\*/u,
	/\*\*[^*]+\*\*/u,
	/~~[^~]+~~/u,
	/`[^`]+`/u,
	/\\\*/u,
	/\[[^\]]+\]\([^\n)]+\)/u,
	/!\[[^\]]+\]\([^\n)]+\)/u,
	/^\[guide\]: /mu,
	/^- /mu,
	/^1\. /mu,
	/^- \[x\] /mu,
	/^> /mu,
	/^\|.+\|$/mu,
	/^~~~json$/mu,
	/^    \S/mu,
	/\[\^lens\]/u,
	/^: /mu,
	/^\$\$$/mu,
	/^<details>$/mu,
] as const;

describe("localized Markdown sample documents", () => {
	for (const locale of rezicsTextLocales) {
		it(`provides a long, representative ${locale} sample`, () => {
			const sample = rezicsTextMessages[locale].sampleDocument;
			expect(sample.length).toBeGreaterThan(1_500);
			expect(sample).not.toContain("\r");
			for (const syntax of representativeSyntax) expect(sample).toMatch(syntax);
		});
	}

	it("keeps each locale's sample distinct", () => {
		const samples = rezicsTextLocales.map((locale) => rezicsTextMessages[locale].sampleDocument);
		expect(new Set(samples).size).toBe(rezicsTextLocales.length);
	});
});
