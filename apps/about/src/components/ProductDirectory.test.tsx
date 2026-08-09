import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ProductDirectory } from "./ProductDirectory";

const layers = [
	{ id: "identity" as const, title: "Identity", body: "Stable identity." },
	{ id: "community" as const, title: "Community", body: "Shared context." },
];
const items = [
	{
		id: "unit",
		layer: "identity" as const,
		stage: "available" as const,
		title: "Work",
		summary: "One identity across languages.",
		href: "/en/products/unit/",
	},
	{
		id: "realm",
		layer: "community" as const,
		stage: "planned" as const,
		title: "Realm",
		summary: "A community around shared interests.",
		href: "/en/products/realm/",
	},
];
const labels = {
	search: "Search capabilities",
	placeholder: "Search by name or purpose",
	all: "All",
	empty: "No capabilities match.",
	open: "View capability",
	stage: {
		legend: "Capability status",
		labels: {
			available: "Available",
			development: "In development",
			planned: "Planned",
		},
	},
};

describe("ProductDirectory", () => {
	test("filters capabilities by reader-entered text", () => {
		render(<ProductDirectory items={items} labels={labels} layers={layers} />);

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "community" },
		});

		expect(screen.getByRole("link", { name: /Realm/ })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Work/ })).not.toBeInTheDocument();
	});

	test("filters by model layer and reports an empty result", () => {
		render(<ProductDirectory items={items} labels={labels} layers={layers} />);

		fireEvent.click(screen.getByRole("button", { name: "Community" }));
		expect(screen.getByRole("link", { name: /Realm/ })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Work/ })).not.toBeInTheDocument();

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "not present" },
		});
		expect(screen.getByText(labels.empty)).toBeInTheDocument();
	});

	test("renders and searches the explicit capability stage", () => {
		render(<ProductDirectory items={items} labels={labels} layers={layers} />);

		expect(screen.getAllByText("Available").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Planned").length).toBeGreaterThan(0);

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "planned" },
		});

		expect(screen.getByRole("link", { name: /Realm/ })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: /Work/ })).not.toBeInTheDocument();
	});
});
