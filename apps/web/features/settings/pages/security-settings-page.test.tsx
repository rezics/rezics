/** @vitest-environment jsdom */

import type {
	ButtonHTMLAttributes,
	HTMLAttributes,
	InputHTMLAttributes,
	LabelHTMLAttributes,
	ReactNode,
} from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
	changePassword: vi.fn(async () => ({ data: null, error: null })),
	listSessions: vi.fn(async () => ({ data: [], error: null })),
	revokeSession: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock("@rezics/ui", () => ({
	Button: ({
		children,
		isLoading: _isLoading,
		size: _size,
		variant: _variant,
		...props
	}: ButtonHTMLAttributes<HTMLButtonElement> & {
		isLoading?: boolean;
		size?: string;
		variant?: string;
	}) => <button {...props}>{children}</button>,
	Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	CardDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	CardHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
	Checkbox: (props: InputHTMLAttributes<HTMLInputElement>) => <input type="checkbox" {...props} />,
	Field: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	FieldGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	FieldLabel: (props: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
	ManagementWorkspaceSectionHeader: ({
		description,
		title,
	}: {
		description: string;
		title: string;
	}) => (
		<header>
			<h1>{title}</h1>
			<p>{description}</p>
		</header>
	),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({
		children,
		...props
	}: HTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("@/features/auth/components/auth-form-field", () => ({
	AuthPasswordField: ({ error, label, name }: { error?: string; label: string; name: string }) => (
		<>
			<label>
				{label}
				<input name={name} type="password" />
			</label>
			{error ? <p>{error}</p> : null}
		</>
	),
}));

vi.mock("@/features/auth/model/password-confirmation", () => ({
	passwordConfirmationMatches: (password: string, confirmation: string) =>
		password === confirmation,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		locale: { current: "en-US" },
		t: {
			auth: {
				confirmPassword: "Confirm password",
				hideConfirmPassword: "Hide password confirmation",
				hideNewPassword: "Hide new password",
				hidePassword: "Hide password",
				passwordMinimum: "At least 8 characters",
				passwordMismatch: "The passwords do not match.",
				showConfirmPassword: "Show password confirmation",
				showNewPassword: "Show new password",
				showPassword: "Show password",
			},
			settings: {
				currentPassword: "Current password",
				currentSession: "Current device",
				lastUpdated: "Recent activity",
				newPassword: "New password",
				revokeOtherSessions: "Sign out other devices after changing password",
				security: "Security",
				securityDescription: "Change your account password.",
				securityGuide: "View the usage guide",
				sessionExpires: "Expires",
				sessions: "Signed-in devices",
				sessionsDescription: "Revoke sessions you no longer use.",
				unknownAddress: "Unknown address",
				unknownDevice: "Unknown device",
				workspace: { backToOverview: "Back to settings" },
			},
			ui: { loading: "Loading…", retryLater: "Try again later.", save: "Save" },
		},
	}),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		changePassword: auth.changePassword,
		listSessions: auth.listSessions,
		revokeSession: auth.revokeSession,
	},
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => ({ data: { session: { token: "current-session" } } }),
}));

import { SecuritySettingsPage } from "./security-settings-page";

beforeEach(() => {
	auth.changePassword.mockClear();
	auth.listSessions.mockClear();
	auth.revokeSession.mockClear();
});

afterEach(cleanup);

describe("security settings password form", () => {
	it("blocks a mismatched confirmation before changing the password", () => {
		render(<SecuritySettingsPage />);

		fireEvent.change(screen.getByLabelText("Current password"), {
			target: { value: "current-password" },
		});
		fireEvent.change(screen.getByLabelText("New password"), {
			target: { value: "new-password" },
		});
		fireEvent.change(screen.getByLabelText("Confirm password"), {
			target: { value: "different-password" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(auth.changePassword).not.toHaveBeenCalled();
		expect(screen.getByText("The passwords do not match.")).toBeTruthy();
	});

	it("does not include the confirmation in the password change request", () => {
		render(<SecuritySettingsPage />);

		fireEvent.change(screen.getByLabelText("Current password"), {
			target: { value: "current-password" },
		});
		fireEvent.change(screen.getByLabelText("New password"), {
			target: { value: "new-password" },
		});
		fireEvent.change(screen.getByLabelText("Confirm password"), {
			target: { value: "new-password" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(auth.changePassword).toHaveBeenCalledWith({
			currentPassword: "current-password",
			newPassword: "new-password",
			revokeOtherSessions: true,
		});
	});
});
