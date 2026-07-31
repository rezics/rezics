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
	it("loads and renders an initial filtered list when opened", async () => {
		const search = vi.fn(async () => [{ id: "entity-id", label: "Studio" }]);
		render(
			<UiProvider searchEntities={search}>
				<EntityPicker
					ariaLabel="Search entities"
					index="entities"
					onChange={vi.fn()}
					placeholder="Enter an entity name"
					searchOnOpen
				/>
			</UiProvider>,
		);

		fireEvent.click(screen.getByRole("combobox", { name: "Search entities" }));

		await waitFor(() =>
			expect(search).toHaveBeenCalledWith("entities", "", expect.any(AbortSignal), {
				kinds: undefined,
			}),
		);
		expect(await screen.findByText("Studio")).toBeTruthy();
	});

	it("clears a selected value when the user edits its label", async () => {
		const onClear = vi.fn();
		render(
			<UiProvider searchEntities={vi.fn(async () => [])}>
				<EntityPicker
					ariaLabel="Search entities"
					index="entity"
					invalid
					onChange={vi.fn()}
					onClear={onClear}
					placeholder="Enter an entity name"
					value={{ id: "entity-id", label: "Selected entity" }}
				/>
			</UiProvider>,
		);

		const input = screen.getByRole("combobox", { name: "Search entities" });
		expect(input.getAttribute("aria-invalid")).toBe("true");
		fireEvent.change(input, { target: { value: "Another entity" } });
		await waitFor(() => expect(onClear).toHaveBeenCalled());
	});

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
