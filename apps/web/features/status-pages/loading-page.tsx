import { Spinner } from "@rezics/ui";

export function LoadingPage() {
	return (
		<main className="grid min-h-[40svh] place-items-center">
			<Spinner />
		</main>
	);
}
