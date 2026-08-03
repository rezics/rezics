/** @vitest-environment jsdom */

import type {
	ButtonHTMLAttributes,
	HTMLAttributes,
	InputHTMLAttributes,
	LabelHTMLAttributes,
	ReactNode,
} from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
	sendVerificationEmail: vi.fn(async () => ({ data: { status: true }, error: null })),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
}));

vi.mock("nuqs", () => ({
	useQueryStates: () => [
		{
			auth: "verify-email",
			email: "registered@example.com",
			error: null,
			next: null,
			token: null,
		},
		vi.fn(),
	],
}));

vi.mock("@rezics/ui", () => ({
	Alert: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	AlertDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
	Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogHeader: ({ description, title }: { description: string; title: string }) => (
		<header>
			<h2>{title}</h2>
			<p>{description}</p>
		</header>
	),
	Field: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	FieldDescription: (props: HTMLAttributes<HTMLParagraphElement>) => <p {...props} />,
	FieldGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	FieldLabel: (props: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} />,
	FieldRequiredIndicator: () => <span>*</span>,
	Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		locale: { target: "en" },
		t: {
			auth: {
				backToLogin: "Back to sign in",
				email: "Email",
				resendVerification: "Resend verification email",
				verificationFailed: "Verification failed.",
				verificationSent: "Verification email sent.",
				verifyDescription: "Confirm your email address.",
				verifyTitle: "Verify email",
			},
		},
	}),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		sendVerificationEmail: auth.sendVerificationEmail,
	},
}));

import { AuthPortalProvider } from "./auth-portal";

beforeEach(() => {
	auth.sendVerificationEmail.mockClear();
});

afterEach(cleanup);

describe("email verification portal", () => {
	it("resends only to the displayed registration email", async () => {
		render(
			<AuthPortalProvider turnstileSiteKey="test-site-key">
				<span>Application</span>
			</AuthPortalProvider>,
		);

		const email = await screen.findByLabelText(/^Email/);
		expect(email).toHaveProperty("readOnly", true);
		expect(email).toHaveProperty("value", "registered@example.com");

		fireEvent.change(email, { target: { value: "different@example.com" } });
		fireEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

		await waitFor(() => {
			expect(auth.sendVerificationEmail).toHaveBeenCalledWith({
				callbackURL: window.location.origin,
				email: "registered@example.com",
			});
		});
	});
});
