"use client";

import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { withContentLanguage } from "../routing/content-language-route";

export function useRequestedContentLanguage(): ContentLanguage | undefined {
	const requestedLanguage = useSearchParams()?.get("language");
	return requestedLanguage && isContentLanguage(requestedLanguage)
		? requestedLanguage
		: undefined;
}

export function useContentLanguageNavigation() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useApplicationRouter();
	const serializedSearchParams = searchParams?.toString() ?? "";
	const currentHref = `${pathname}${serializedSearchParams ? `?${serializedSearchParams}` : ""}`;

	const replaceCurrentLanguage = useCallback(
		(language: ContentLanguage | undefined) => {
			const hash = window.location.hash;
			router.replace(withContentLanguage(`${currentHref}${hash}`, language), {
				scroll: false,
			});
		},
		[currentHref, router],
	);
	const pushLanguage = useCallback(
		(href: string, language: ContentLanguage | undefined) => {
			router.push(withContentLanguage(href, language));
		},
		[router],
	);

	return { pushLanguage, replaceCurrentLanguage };
}
