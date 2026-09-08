import {
	AppWindowIcon,
	BookOpenIcon,
	ClapperboardIcon,
	LibraryIcon,
	Music2Icon,
} from "lucide-react";

export function UnitCoverFallback({ kind }: { readonly kind: string }) {
	const Icon =
		kind === "publishing"
			? BookOpenIcon
			: kind === "program" || kind === "video"
				? ClapperboardIcon
				: kind === "software"
					? AppWindowIcon
					: kind === "music" || kind === "audio"
						? Music2Icon
						: LibraryIcon;
	return <Icon aria-hidden className="size-7 text-muted-foreground" />;
}
