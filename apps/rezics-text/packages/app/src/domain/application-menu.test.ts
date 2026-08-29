import { describe, expect, it } from "vitest";
import { isRezicsTextApplicationCommand } from "./application-menu";

describe("application menu commands", () => {
	it("accepts only the known workspace menu commands", () => {
		expect(isRezicsTextApplicationCommand("new-document")).toBe(true);
		expect(isRezicsTextApplicationCommand("new-folder")).toBe(true);
		expect(isRezicsTextApplicationCommand("toggle-sidebar")).toBe(true);
		expect(isRezicsTextApplicationCommand("print")).toBe(false);
	});
});
