import type { ComponentProps } from "react";

import { cn } from "../utils";

export function Banner({
	alt,
	className,
	imageClassName,
	priority = false,
	sizes,
	src,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	alt: string;
	imageClassName?: string;
	priority?: boolean;
	sizes?: string;
	src?: string | null;
}) {
	return (
		<div
			className={cn(
				"relative isolate aspect-[4/1] overflow-hidden bg-surface-container",
				className,
			)}
			data-slot="banner"
			{...props}
		>
			{src ? (
				<>
					<img
						alt=""
						aria-hidden
						className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-55 blur-xl saturate-75"
						data-slot="banner-backdrop"
						decoding="async"
						loading={priority ? "eager" : "lazy"}
						src={src}
					/>
					<div aria-hidden className="absolute inset-0 bg-black/6 dark:bg-black/22" />
					<img
						alt={alt}
						className={cn(
							"absolute inset-0 z-10 size-full object-cover object-left-top",
							imageClassName,
						)}
						data-slot="banner-image"
						decoding="async"
						loading={priority ? "eager" : "lazy"}
						sizes={sizes}
						src={src}
					/>
				</>
			) : null}
		</div>
	);
}
