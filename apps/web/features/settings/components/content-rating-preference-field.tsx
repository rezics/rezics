"use client";

import { PutApiUsersMePreferencesRequestContentRatingsEnum } from "@rezics/openapi-tanstack-query";
import {
	Alert,
	AlertDescription,
	Checkbox,
	CheckboxGroup,
	Field,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@rezics/ui";

const ContentRatings = Object.values(PutApiUsersMePreferencesRequestContentRatingsEnum);
export type ContentRating = (typeof ContentRatings)[number];

function isContentRating(value: string): value is ContentRating {
	return ContentRatings.some((rating) => rating === value);
}

export function ContentRatingPreferenceField({
	generalLabel,
	invalid,
	invalidMessage,
	legend,
	onChange,
	value,
}: {
	readonly generalLabel: string;
	readonly invalid: boolean;
	readonly invalidMessage: string;
	readonly legend: string;
	readonly onChange: (value: ContentRating[]) => void;
	readonly value: ContentRating[];
}) {
	return (
		<FieldSet>
			<FieldLegend variant="label">{legend}</FieldLegend>
			<CheckboxGroup
				className="grid gap-2 sm:grid-cols-2"
				name="contentRating"
				onValueChange={(values) => onChange(values.filter(isContentRating))}
				value={value}
			>
				{ContentRatings.map((rating) => (
					<Field invalid={invalid} key={rating} orientation="horizontal">
						<Checkbox value={rating} />
						<FieldLabel className="font-normal">
							{rating === "general" ? generalLabel : rating.toUpperCase()}
						</FieldLabel>
					</Field>
				))}
			</CheckboxGroup>
			{invalid && (
				<Alert variant="destructive">
					<AlertDescription>{invalidMessage}</AlertDescription>
				</Alert>
			)}
		</FieldSet>
	);
}
