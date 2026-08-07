/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AuthPasswordField, AuthTextField } from "./auth-form-field";

afterEach(cleanup);

describe("authentication form fields", () => {
	it("keeps a required text field label visible and associated with its input", () => {
		render(
			<AuthTextField label="Email" name="email" placeholder="you@example.com" type="email" />,
		);

		const input = screen.getByLabelText(/^Email/);
		const label = screen.getByText("Email").closest("label");

		expect(input.getAttribute("name")).toBe("email");
		expect(input.hasAttribute("required")).toBe(true);
		expect(label?.classList.contains("sr-only")).toBe(false);
	});

	it("keeps password guidance available and exposes a keyboard-focusable visibility control", () => {
		render(
			<AuthPasswordField
				autoComplete="new-password"
				description="At least 8 characters"
				label="New password"
				minLength={8}
				name="password"
				visibilityLabel={(visible) => (visible ? "Hide new password" : "Show new password")}
			/>,
		);

		const input = screen.getByLabelText(/^New password/);
		const showPassword = screen.getByRole("button", { name: "Show new password" });

		expect(input.getAttribute("type")).toBe("password");
		expect(input.getAttribute("aria-describedby")).toBe(
			screen.getByText("At least 8 characters").getAttribute("id"),
		);
		expect(showPassword.getAttribute("tabindex")).toBe("0");

		fireEvent.click(showPassword);

		expect(input.getAttribute("type")).toBe("text");
		expect(screen.getByRole("button", { name: "Hide new password" })).toBeTruthy();
	});

	it("associates a mismatch message with the confirmation input", () => {
		render(
			<AuthPasswordField
				autoComplete="new-password"
				error="The passwords do not match."
				label="Confirm password"
				minLength={8}
				name="confirmPassword"
				visibilityLabel={(visible) =>
					visible ? "Hide password confirmation" : "Show password confirmation"
				}
			/>,
		);

		const input = screen.getByLabelText(/^Confirm password/);
		const error = screen.getByText("The passwords do not match.");
		const errorId = error.getAttribute("id");

		expect(errorId).toBeTruthy();
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(input.getAttribute("aria-describedby")).toContain(errorId ?? "");
	});
});
