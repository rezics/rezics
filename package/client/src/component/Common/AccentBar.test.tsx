import { AccentBar, AccentBarWithText } from "./AccentBar";
import { useFixtureInput } from "react-cosmos/client";

export default {
	AccentBar: () => {
		const [props] = useFixtureInput<
			Parameters<typeof AccentBar.Container>[0]
		>("AccentBar Props", {
			height: 24,
			color: "#1976d2",
		});

		return (
			<div className="p-4">
				<AccentBar.Container {...props} />
			</div>
		);
	},

	AccentBarWithText: () => {
		const [props] = useFixtureInput<
			Parameters<typeof AccentBarWithText.Container>[0]
		>("AccentBarWithText Props", {
			height: 24,
			color: "#1976d2",
			text: "标题文本",
		});

		return (
			<div className="p-4">
				<AccentBarWithText.Container {...props} />
			</div>
		);
	},
};
