/** @vitest-environment jsdom */

import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
	ContentRatingPreferenceField,
	type ContentRating,
} from "./content-rating-preference-field";

function PreferenceProbe() {
	const [value, setValue] = useState<ContentRating[]>(["general", "r15"]);
	return (
		<form data-testid="preferences">
			<ContentRatingPreferenceField
				generalLabel="General"
				invalid={false}
				invalidMessage="Invalid"
				legend="Content rating"
				onChange={setValue}
				value={value}
			/>
		</form>
	);
}

describe("ContentRatingPreferenceField", () => {
	it("keeps the controlled group and submitted form values synchronized", () => {
		const { container, getByTestId } = render(<PreferenceProbe />);
		const form = getByTestId("preferences") as HTMLFormElement;
		const submittedRatings = () => new FormData(form).getAll("contentRating");
		const input = (rating: ContentRating) => {
			const element = container.querySelector(`input[value="${rating}"]`);
			if (!(element instanceof HTMLInputElement))
				throw new Error(`Missing ${rating} content rating input`);
			return element;
		};

		expect(submittedRatings()).toEqual(["general", "r15"]);

		fireEvent.click(input("r15"));
		expect(submittedRatings()).toEqual(["general"]);

		fireEvent.click(input("r18"));
		expect(submittedRatings()).toEqual(["general", "r18"]);
	});
});
