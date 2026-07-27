/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			previewAccess: {
				title: "Preview access required",
				description: "This feature is not publicly available.",
				openSourcePrefix: "The project is open source at",
				openSourceSuffix: ".",
				participationPrefix: "To participate,",
				contact: "contact us",
				participationSuffix: ".",
			},
		},
	}),
}));
vi.mock("@rezics/icons/components/brand/GithubIcon", () => ({
	default: () => <svg aria-hidden />,
}));
vi.mock("@rezics/ui", () => ({
	Card: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	CardContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
}));

import { PreviewAccessNotice } from "./preview-access-notice";

describe("PreviewAccessNotice", () => {
	afterEach(cleanup);

	it("opens the contact page in a new browsing context", () => {
		render(<PreviewAccessNotice />);

		const contact = screen.getByRole("link", { name: "contact us" });
		expect(contact.getAttribute("href")).toBe("https://about.rezics.com/contact-us/");
		expect(contact.getAttribute("target")).toBe("_blank");
		expect(contact.getAttribute("rel")).toContain("noreferrer");
	});
});
