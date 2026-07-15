import type { ComponentPropsWithoutRef } from "react";

import logo from "@rezics/brand/mark.svg?url&no-inline";

export type LogoProps = Omit<ComponentPropsWithoutRef<"img">, "src">;

export function Logo({ alt = "REZICS", ...props }: LogoProps) {
	return <img alt={alt} src={logo} {...props} />;
}
