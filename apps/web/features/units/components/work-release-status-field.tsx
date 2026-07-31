import { Field, FieldLabel, NativeSelect, NativeSelectOption } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { type WorkReleaseStatus, WorkReleaseStatusValues } from "../model/work-release-status";

export function WorkReleaseStatusField({
	defaultValue = "ongoing",
}: {
	readonly defaultValue?: WorkReleaseStatus;
}) {
	const { t } = useTranslation("units");
	return (
		<Field required>
			<FieldLabel>{t.fields.releaseStatus}</FieldLabel>
			<NativeSelect defaultValue={defaultValue} name="releaseStatus" required>
				{WorkReleaseStatusValues.map((status) => (
					<NativeSelectOption key={status} value={status}>
						{t.releaseStatuses[status]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</Field>
	);
}
