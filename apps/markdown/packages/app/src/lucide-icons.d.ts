declare module "lucide-react/dist/esm/icons/*.mjs" {
	import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from "react";

	const Icon: ForwardRefExoticComponent<
		Omit<SVGProps<SVGSVGElement>, "ref"> & RefAttributes<SVGSVGElement>
	>;
	export default Icon;
}
