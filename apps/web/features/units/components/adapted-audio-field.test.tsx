/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaximumAudioTracksPerVideo } from "../model/adapted-audio";
import { AdaptedAudioField } from "./adapted-audio-field";

const picker = vi.hoisted(() => ({ props: undefined as undefined | Record<string, unknown> }));

vi.mock("@rezics/ui", () => {
	const Block = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
		Field: Block,
		FieldDescription: Block,
		FieldLabel: Block,
		UnitMultiPicker: (props: Record<string, unknown>) => {
			picker.props = props;
			return (
				<button
					onClick={() =>
						(props.onValuesChange as (value: readonly string[]) => void)(["audio-unit"])
					}
					type="button"
				>
					Choose audio
				</button>
			);
		},
	};
});

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			ui: { pickerPlaceholders: { unit: "Find a Unit" } },
			units: {
				fields: {
					adaptedAudio: "Adapted Audio",
					adaptedAudioDescription: "Choose replacement audio.",
					removeAdaptedAudio: "Remove adapted audio",
				},
			},
		},
	}),
}));

afterEach(() => {
	cleanup();
	picker.props = undefined;
});

describe("AdaptedAudioField", () => {
	it("restricts the shared Unit picker to the public Audio relation contract", () => {
		const onChange = vi.fn();
		render(<AdaptedAudioField onChange={onChange} value={["existing-audio"]} />);

		expect(picker.props).toMatchObject({
			kinds: ["audio"],
			maxValues: MaximumAudioTracksPerVideo,
			values: ["existing-audio"],
		});
		fireEvent.click(screen.getByRole("button", { name: "Choose audio" }));
		expect(onChange).toHaveBeenCalledWith(["audio-unit"]);
	});
});
