/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { StandardTokenPolicyLimitRanges } from "../model/token-policy-limits";
import { PolicyLimitField } from "./token-settings-page";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["settings"], ["zh-Hant"]);

function LimitFieldProbe() {
	const [value, setValue] = useState("");
	return (
		<TranslationProvider initial={translation.snapshot}>
			<PolicyLimitField
				label="每分鐘要求數"
				name="requestsPerMinute"
				onChange={setValue}
				range={StandardTokenPolicyLimitRanges.requestsPerMinute}
				value={value}
			/>
		</TranslationProvider>
	);
}

describe("PolicyLimitField", () => {
	it("shows the range as the empty placeholder and gives immediate range feedback", () => {
		const { container } = render(<LimitFieldProbe />);
		const input = screen.getByRole("spinbutton", { name: "每分鐘要求數" });
		expect(input.getAttribute("placeholder")).toBe("範圍：1–300");
		expect(input.getAttribute("aria-invalid")).toBeNull();

		fireEvent.change(input, { target: { value: "301" } });

		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(screen.getByText("請輸入 1 至 300 之間的整數。")).toBeTruthy();
		expect(container.querySelector('[data-align="inline-end"] svg')).not.toBeNull();
	});
});
