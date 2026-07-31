// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UiProvider } from "@rezics/ui";
import { EntityPicker } from "@rezics/ui/custom/entity-picker";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

afterEach(cleanup);

describe("EntityPicker no-result actions", () => {
	it("renders the owner action only after a successful zero-result search", async () => {
		const search = vi.fn(async () => []);
		render(
			<UiProvider searchEntities={search}>
				<EntityPicker
					ariaLabel="Search tags"
					index="tags"
					onChange={vi.fn()}
					placeholder="Enter a tag name"
					renderNoResultsAction={(query) => <a href="/create">{`Create ${query}`}</a>}
				/>
			</UiProvider>,
		);

		const input = screen.getByRole("combobox", { name: "Search tags" });
		expect(input.getAttribute("placeholder")).toBe("Enter a tag name");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "science" } });
		expect(screen.queryByRole("link", { name: "Create science" })).toBeNull();

		await waitFor(() => expect(search).toHaveBeenCalledOnce());
		expect(await screen.findByRole("link", { name: "Create science" })).toBeTruthy();
	});

	it("does not render the action for hits or search failures", async () => {
		const search = vi
			.fn()
			.mockResolvedValueOnce([{ id: "tag-id", label: "Science" }])
			.mockRejectedValueOnce(new Error("search unavailable"));
		const { rerender } = render(
			<UiProvider searchEntities={search}>
				<EntityPicker
					ariaLabel="Search tags"
					index="tags"
					onChange={vi.fn()}
					placeholder="Enter a tag name"
					renderNoResultsAction={(query) => <a href="/create">{`Create ${query}`}</a>}
				/>
			</UiProvider>,
		);

		const input = screen.getByRole("combobox");
		fireEvent.focus(input);
		fireEvent.change(input, { target: { value: "science" } });
		await waitFor(() => expect(search).toHaveBeenCalledOnce());
		expect(screen.queryByRole("link", { name: "Create science" })).toBeNull();

		rerender(
			<UiProvider searchEntities={search}>
				<EntityPicker
					ariaLabel="Search tags"
					index="tags"
					onChange={vi.fn()}
					placeholder="Enter a tag name"
					renderNoResultsAction={(query) => <a href="/create">{`Create ${query}`}</a>}
				/>
			</UiProvider>,
		);
		fireEvent.change(input, { target: { value: "broken" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
		expect(screen.queryByRole("link", { name: "Create broken" })).toBeNull();
	});
});
