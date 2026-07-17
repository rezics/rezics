import type { ReactNode } from "react";

import { cn } from "../utils";

export function PageHeading({
	title,
	description,
	action,
	className,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
			<div className="min-w-0 max-w-3xl">
				<h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
					{title}
				</h1>
				{description ? (
					<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
						{description}
					</p>
				) : null}
			</div>
			{action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
		</header>
	);
}
