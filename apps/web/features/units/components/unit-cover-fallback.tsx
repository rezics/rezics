import { AppWindowIcon, BookOpenIcon, ClapperboardIcon, LibraryIcon } from "lucide-react";

export function UnitCoverFallback({ kind }: { readonly kind: string }) {
	const Icon =
		kind === "book"
			? BookOpenIcon
			: kind === "media"
				? ClapperboardIcon
				: kind === "software"
					? AppWindowIcon
					: LibraryIcon;
	return <Icon aria-hidden className="size-7 text-muted-foreground" />;
}
