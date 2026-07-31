"use client";

import {
	type GetApiTagsByTagIdStatus200,
	useGetApiTagsByTagId,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";
import { useLocalizationFallbackToast } from "@/i18n/use-localization-fallback-toast";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { getTagDetailHrefs, parseTagDetailSection } from "../routing/tag-links";
import { TagDetailHero } from "./tag-detail-hero";

const TagDetailContext = createContext<GetApiTagsByTagIdStatus200 | undefined>(undefined);

export function useTagDetail(): GetApiTagsByTagIdStatus200 {
	const value = useContext(TagDetailContext);
	if (!value) throw new Error("Tag detail content must be rendered inside its workspace");
	return value;
}

export function TagDetailWorkspace({
	children,
	tagId,
}: {
	readonly children: ReactNode;
	readonly tagId: string;
}) {
	const localizationLanguages = useLocalizationLanguages();
	const query = useGetApiTagsByTagId({
		path: { tagId },
		query: { localizationLanguages },
	});
	useLocalizationFallbackToast({
		actualLanguage: query.data?.language ?? null,
		localizationLanguages,
		unitId: tagId,
	});
	if (query.isPending) return <QueryPending />;
	if (query.isError || !query.data)
		return <QueryFailure error={query.error} retry={() => void query.refetch()} />;

	return (
		<TagDetailContext.Provider value={query.data}>
			<TagDetailShell tag={query.data}>{children}</TagDetailShell>
		</TagDetailContext.Provider>
	);
}

function TagDetailShell({
	children,
	tag,
}: {
	readonly children: ReactNode;
	readonly tag: GetApiTagsByTagIdStatus200;
}) {
	const pathname = usePathname();
	const { t } = useTranslation(["tags"]);
	const currentSection = parseTagDetailSection(pathname, tag.id);
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
			<TagDetailHero tag={tag} />
			<nav
				aria-label={t.tags.detail.sections}
				className="flex gap-1 overflow-x-auto border-b border-border-weak"
			>
				{getTagDetailHrefs(tag.id).map(({ id, href }) => (
					<Link
						aria-current={currentSection === id ? "page" : undefined}
						className={
							currentSection === id
								? "shrink-0 border-b-2 border-brand px-3 py-3 text-sm font-semibold text-foreground"
								: "shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
						}
						href={href}
						key={id}
					>
						{t.tags.detail.tabs[id]}
					</Link>
				))}
			</nav>
			{children}
		</main>
	);
}
