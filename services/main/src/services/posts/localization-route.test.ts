import { describe, expect, it } from "vitest";

import { PostKindValues } from "@rezics/schema/postgres/shared/contract-values";
import { usesSharedPostLocalizationRoute } from "./localization-route";

describe("shared Post localization route", () => {
	it.each(PostKindValues)("classifies the %s storage format deliberately", (kind) => {
		expect(usesSharedPostLocalizationRoute(kind)).toBe(
			kind === "post" || kind === "reply" || kind === "excerpt" || kind === "wiki",
		);
	});
});
