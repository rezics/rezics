import type { ReactNode } from "react";

export function PageHeading({
	title,
	description,
	action,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
			<div className="flex flex-col gap-2">
				<h1 className="font-heading text-2xl font-black tracking-tight sm:text-3xl">
					{title}
				</h1>
				{description && <p className="text-muted-foreground max-w-2xl">{description}</p>}
			</div>
			{action}
		</div>
	);
}
