import { describe, expect, it } from "vitest";
import { isMarkdownApplicationCommand } from "./application-menu";

describe("application menu commands", () => {
	it("accepts only the known workspace menu commands", () => {
		expect(isMarkdownApplicationCommand("new-document")).toBe(true);
		expect(isMarkdownApplicationCommand("new-folder")).toBe(true);
		expect(isMarkdownApplicationCommand("toggle-sidebar")).toBe(true);
		expect(isMarkdownApplicationCommand("print")).toBe(false);
	});
});
