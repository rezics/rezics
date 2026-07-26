import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Banner } from "@rezics/ui";

describe("Banner", () => {
	it("keeps a fixed 4:1 frame and anchors a covered foreground image at top-left", () => {
		const markup = renderToStaticMarkup(
			<Banner alt="Realm artwork" src="https://example.com/banner.jpg" />,
		);

		expect(markup).toContain('data-slot="banner"');
		expect(markup).toContain("aspect-[4/1]");
		expect(markup).toContain('data-slot="banner-image"');
		expect(markup).toContain("absolute inset-0 z-10 size-full object-cover object-left-top");
	});

	it("exposes the supplied alternative text only on the foreground image", () => {
		const markup = renderToStaticMarkup(
			<Banner alt="Realm artwork" src="https://example.com/banner.jpg" />,
		);

		expect(markup.match(/alt="Realm artwork"/g)).toHaveLength(1);
		expect(markup).toContain('data-slot="banner-backdrop"');
		expect(markup).toContain('alt="" aria-hidden="true"');
	});

	it("keeps the same frame when no image is available", () => {
		const markup = renderToStaticMarkup(<Banner alt="" />);

		expect(markup).toContain('data-slot="banner"');
		expect(markup).toContain("aspect-[4/1]");
		expect(markup).not.toContain("<img");
	});
});
