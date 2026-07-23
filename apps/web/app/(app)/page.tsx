import { Home } from "@/features/explore/home";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function HomePage() {
	return (
		<TranslationBoundary namespaces={["feed", "posts"]}>
			<Home />
		</TranslationBoundary>
	);
}
