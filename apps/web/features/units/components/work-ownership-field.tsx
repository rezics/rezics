"use client";

import {
	Button,
	Field,
	FieldDescription,
	FieldLabel,
	NativeSelect,
	NativeSelectOption,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@rezics/ui";
import { CircleHelp } from "lucide-react";

import { useTranslation } from "@/i18n/client";

export type WorkOwnershipMode = "profile_owned" | "community_owned";

export function isWorkOwnershipMode(value: unknown): value is WorkOwnershipMode {
	return value === "profile_owned" || value === "community_owned";
}

export function WorkOwnershipField({
	onChange,
	value,
}: {
	readonly onChange: (value: WorkOwnershipMode) => void;
	readonly value: WorkOwnershipMode;
}) {
	const { t } = useTranslation(["units"]);
	const creation = t.units.creation;

	return (
		<Field required>
			<FieldLabel>{creation.workOwnershipLabel}</FieldLabel>
			<NativeSelect
				name="ownershipMode"
				onChange={(event) => {
					const nextValue = event.currentTarget.value;
					if (isWorkOwnershipMode(nextValue)) onChange(nextValue);
				}}
				value={value}
			>
				<NativeSelectOption value="profile_owned">{creation.ownedWork}</NativeSelectOption>
				<NativeSelectOption value="community_owned">
					{creation.publicWork}
				</NativeSelectOption>
			</NativeSelect>
			<FieldDescription>
				{value === "profile_owned"
					? creation.ownedWorkDescription
					: creation.publicWorkDescription}
			</FieldDescription>
			{value === "community_owned" ? (
				<Popover
					autoFocus={false}
					closeOnEscape
					closeOnInteractOutside
					modal={false}
					positioning={{ placement: "bottom-start", gutter: 6 }}
				>
					<PopoverTrigger asChild>
						<Button className="w-fit" size="xs" type="button" variant="link">
							{creation.publicWorkLearnMore}
							<CircleHelp aria-hidden data-icon="inline-end" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[min(24rem,calc(100vw-2rem))]">
						<PopoverHeader>
							<PopoverTitle>{creation.publicWorkHelpTitle}</PopoverTitle>
						</PopoverHeader>
						<PopoverBody className="flex flex-col gap-3 text-sm leading-6">
							<p>{creation.publicWorkHelpOwnership}</p>
							<p>{creation.publicWorkHelpIndexing}</p>
							<p>{creation.publicWorkHelpAlternative}</p>
						</PopoverBody>
					</PopoverContent>
				</Popover>
			) : null}
		</Field>
	);
}
