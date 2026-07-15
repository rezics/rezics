import React from "react";

const MobileBreakpoint = 768;

export const useIsMobile = () => {
	const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MobileBreakpoint - 1}px)`);

		const onChange = () => {
			setIsMobile(window.innerWidth < MobileBreakpoint);
		};

		mql.addEventListener("change", onChange);

		setIsMobile(window.innerWidth < MobileBreakpoint);

		return () => mql.removeEventListener("change", onChange);
	}, []);

	return !!isMobile;
};
