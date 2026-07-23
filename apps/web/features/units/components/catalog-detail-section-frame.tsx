import type { ReactNode } from "react";

import { PageHeading } from "@rezics/ui";

export function CatalogDetailSectionFrame({
	children,
	description,
	title,
	action,
}: {
	children: ReactNode;
	description: string;
	title: string;
	action?: ReactNode;
}) {
	return (
		<section className="grid min-w-0 gap-6">
			<PageHeading action={action} description={description} title={title} />
			{children}
		</section>
	);
}
