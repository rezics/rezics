import { useState } from "react";
import { expect, fn } from "storybook/test";
import { PermissionMatrix } from "@rezics/ui";
import preview from "@/.storybook/preview";
import { useTranslation } from "@/i18n/client";

const meta = preview.meta({
	component: PermissionMatrix,
	tags: ["ai-generated"],
	args: {
		resources: [],
		value: new Set<string>(["read"]),
		onValueChange: fn(),
		labels: {
			templates: "",
			permissions: "",
			searchPlaceholder: "",
			clear: "",
			selected: () => "",
			categorySelected: () => "",
			required: "",
			empty: "",
		},
	},
	render: function Render(args) {
		const { t } = useTranslation(["governance", "ui"]);
		const copy = t.governance.access.matrix;
		const [value, setValue] = useState(args.value);
		return (
			<PermissionMatrix
				{...args}
				resources={[
					{
						id: "document",
						category: copy.permissions,
						label: "Reader notes",
						actions: [
							{
								value: "read",
								label: t.governance.access.permissions["unit.read"],
								required: true,
							},
							{ value: "edit", label: t.ui.edit },
							{
								value: "delete",
								label: t.governance.access.permissions["unit.ownership.transfer"],
								disabled: true,
							},
						],
					},
				]}
				value={value}
				onValueChange={(next) => {
					setValue(next);
					args.onValueChange(next);
				}}
				labels={{
					...copy,
					selected: (selected, total) => copy.selected({ selected, total }),
					categorySelected: (selected) => copy.categorySelected({ selected }),
				}}
			/>
		);
	},
});
export default meta;
export const RequiredAndDisabled = meta.story({
	globals: { locale: "en" },
	play: async ({ canvas, userEvent, args }) => {
		const read = canvas.getByRole("button", { name: "Read" });
		await userEvent.click(read);
		await expect(read).toHaveAttribute("aria-pressed", "true");
		await expect(args.onValueChange).not.toHaveBeenCalled();
		await expect(canvas.getByRole("button", { name: "Transfer ownership" })).toBeDisabled();
		await userEvent.click(canvas.getByRole("button", { name: "Edit" }));
		await expect(args.onValueChange).toHaveBeenCalledWith(new Set(["read", "edit"]));
	},
});
export const SearchEmpty = meta.story({
	play: async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByRole("searchbox"), "no-matching-resource");
		await expect(canvas.queryByText("Reader notes")).not.toBeInTheDocument();
	},
});
