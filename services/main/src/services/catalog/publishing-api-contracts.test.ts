import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as contracts from "./publishing-api-contracts";
import { publishingComponentRevisionValue } from "./publishing-components";

describe("Publishing wire and immutable child projections", () => {
	it("exports every public schema without canonicalization transforms", () => {
		let count = 0;
		for (const value of Object.values(contracts))
			if (value instanceof z.ZodType) {
				expect(() => z.toJSONSchema(value)).not.toThrow();
				count++;
			}
		expect(count).toBe(17);
	});
	it("projects release-event history as native fields without Auth attribution", () => {
		const value = publishingComponentRevisionValue("publishing_release_event", {
			id: crypto.randomUUID(),
			publication_id: crypto.randomUUID(),
			publisher_entity_id: null,
			publisher_credit: "Printed credit",
			area_id: null,
			date_year: 1900,
			date_month: null,
			date_day: null,
			date_text: "circa 1900",
			created_by_auth_user_id: crypto.randomUUID(),
		});
		expect(value).toEqual({
			kind: "event",
			publisherEntityId: null,
			publisherCredit: "Printed credit",
			areaId: null,
			date: { year: 1900, month: null, day: null },
			dateText: "circa 1900",
		});
	});
	it("keeps direct publication Work coverage separate from identified text coverage", () => {
		const target = crypto.randomUUID();
		const direct = publishingComponentRevisionValue("publishing_publication_work", {
			work_id: target,
			position: 2,
			coverage_text: "selected chapters",
		});
		const text = publishingComponentRevisionValue("publishing_publication_text", {
			text_version_id: target,
			position: 2,
			coverage_text: null,
		});
		expect(direct).toEqual({
			kind: "publication_work",
			targetId: target,
			position: 2,
			coverageText: "selected chapters",
		});
		expect(text.kind).toBe("publication_text");
	});
	it("retains serial hierarchy and original date text independently", () => {
		const parent = crypto.randomUUID(),
			kind = crypto.randomUUID();
		expect(
			publishingComponentRevisionValue("publishing_installment", {
				parent_id: parent,
				position: "a0",
				label: "Part 1",
				kind_revision_id: kind,
				date_year: null,
				date_month: null,
				date_day: null,
				date_text: "forthcoming",
			}),
		).toEqual({
			kind: "installment",
			parentId: parent,
			position: "a0",
			label: "Part 1",
			kindRevisionId: kind,
			date: { year: null, month: null, day: null },
			dateText: "forthcoming",
		});
	});
});
