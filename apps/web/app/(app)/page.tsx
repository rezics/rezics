import { Home } from "@/features/explore/home";
import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = ["feed", "posts"] as const;

export default function HomePage() {
	return (
		<TranslationBoundary namespaces={Namespaces}>
			<Home />
		</TranslationBoundary>
	);
}
