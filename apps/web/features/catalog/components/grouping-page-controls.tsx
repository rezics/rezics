"use client";
import { Button } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
export type GroupingEditContext = {
	id: string;
	revision: number;
	canEdit: boolean;
	onChanged: () => void;
};
export function GroupingPager({
	previous,
	next,
	onPrevious,
	onNext,
}: {
	previous: boolean;
	next: boolean;
	onPrevious: () => void;
	onNext: () => void;
}) {
	const { t } = useTranslation(["ui"]);
	return (
		<div className="flex gap-2">
			{previous ? (
				<Button variant="outline" onClick={onPrevious}>
					{t.ui.shelf.previous}
				</Button>
			) : null}
			{next ? (
				<Button variant="outline" onClick={onNext}>
					{t.ui.shelf.next}
				</Button>
			) : null}
		</div>
	);
}
