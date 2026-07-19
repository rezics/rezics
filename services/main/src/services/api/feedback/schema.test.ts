import { createPortableTextDocument } from "@rezics/block";
import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { CreateFeedbackBody } from "./schema";

const content = createPortableTextDocument([], "0123456789ab");

describe("feedback API contract", () => {
	it("stores authored feedback as localized Portable Text", () => {
		expect(Check(CreateFeedbackBody, { type: "report", language: "en", content })).toBe(true);
		expect(Check(CreateFeedbackBody, { type: "report", content: "copied text" })).toBe(false);
	});
});
