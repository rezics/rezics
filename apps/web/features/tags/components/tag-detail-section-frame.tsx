import type { ReactNode } from "react";

import { PageHeading } from "@rezics/ui";

export function TagDetailSectionFrame({
	children,
	description,
	title,
}: {
	readonly children: ReactNode;
	readonly description: string;
	readonly title: string;
}) {
	return (
		<section className="grid min-w-0 gap-6">
			<PageHeading description={description} title={title} />
			{children}
		</section>
	);
}
