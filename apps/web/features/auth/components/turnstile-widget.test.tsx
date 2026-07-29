/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegistrationTurnstileAction, TurnstileWidget } from "./turnstile-widget";

type CapturedOptions = {
	action: string;
	callback: (token: string) => void;
	"error-callback": () => void;
	"expired-callback": () => void;
	language: string;
	"response-field": boolean;
	sitekey: string;
};

let capturedOptions: CapturedOptions | undefined;
const remove = vi.fn();
const renderWidget = vi.fn((_container: HTMLElement, options: CapturedOptions) => {
	capturedOptions = options;
	return "registration-widget";
});

beforeEach(() => {
	capturedOptions = undefined;
	remove.mockClear();
	renderWidget.mockClear();
	Reflect.set(window, "turnstile", {
		remove,
		render: renderWidget,
	});
});

afterEach(() => {
	cleanup();
	Reflect.deleteProperty(window, "turnstile");
});

describe("TurnstileWidget", () => {
	it("renders an explicit registration challenge and forwards only fresh tokens", async () => {
		const onTokenChange = vi.fn();
		const view = render(
			<TurnstileWidget
				label="Security verification"
				locale="zh-Hant"
				onTokenChange={onTokenChange}
				resetKey={0}
				siteKey="public-site-key"
				unavailableMessage="Security verification unavailable."
			/>,
		);

		await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
		expect(capturedOptions).toMatchObject({
			action: RegistrationTurnstileAction,
			language: "zh-tw",
			"response-field": false,
			sitekey: "public-site-key",
		});
		expect(onTokenChange).toHaveBeenLastCalledWith(null);

		act(() => capturedOptions?.callback("fresh-token"));
		expect(onTokenChange).toHaveBeenLastCalledWith("fresh-token");

		act(() => capturedOptions?.["expired-callback"]());
		expect(onTokenChange).toHaveBeenLastCalledWith(null);

		view.unmount();
		expect(remove).toHaveBeenCalledWith("registration-widget");
	});

	it("clears the token and exposes a localized message when the challenge fails", async () => {
		const onTokenChange = vi.fn();
		render(
			<TurnstileWidget
				label="Security verification"
				locale="en"
				onTokenChange={onTokenChange}
				resetKey={0}
				siteKey="public-site-key"
				unavailableMessage="Security verification unavailable."
			/>,
		);

		await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
		act(() => capturedOptions?.["error-callback"]());

		expect(onTokenChange).toHaveBeenLastCalledWith(null);
		expect(screen.getByRole("alert").textContent).toBe("Security verification unavailable.");
	});
});
