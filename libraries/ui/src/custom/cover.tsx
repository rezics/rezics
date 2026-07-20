import type { ComponentProps, ReactNode } from "react";

import { cn } from "../utils";

export function Cover({
	alt,
	className,
	fallback,
	imageClassName,
	priority = false,
	sizes,
	src,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	alt: string;
	fallback?: ReactNode;
	imageClassName?: string;
	priority?: boolean;
	sizes?: string;
	src?: string | null;
}) {
	return (
		<div
			className={cn(
				"relative isolate aspect-[3/4] overflow-hidden bg-surface-container",
				className,
			)}
			data-slot="cover"
			{...props}
		>
			{src ? (
				<>
					<img
						alt=""
						aria-hidden
						className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-55 blur-xl saturate-75"
						src={src}
					/>
					<div aria-hidden className="absolute inset-0 bg-black/6 dark:bg-black/22" />
					<img
						alt={alt}
						className={cn("relative z-10 size-full object-contain", imageClassName)}
						decoding="async"
						loading={priority ? "eager" : "lazy"}
						sizes={sizes}
						src={src}
					/>
				</>
			) : (
				<div
					className="grid size-full place-items-center text-accent-foreground"
					role="img"
					aria-label={alt}
				>
					{fallback}
				</div>
			)}
		</div>
	);
}
