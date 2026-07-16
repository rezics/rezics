import { useEffect } from "react";

export function useReveal(routeKey: string) {
	useEffect(() => {
		const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
		if (
			window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
			!("IntersectionObserver" in window)
		) {
			elements.forEach((element) => element.classList.add("is-visible"));
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) return;
					(entry.target as HTMLElement).classList.add("is-visible");
					observer.unobserve(entry.target);
				});
			},
			{ rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
		);
		elements.forEach((element) => observer.observe(element));
		return () => observer.disconnect();
	}, [routeKey]);
}
