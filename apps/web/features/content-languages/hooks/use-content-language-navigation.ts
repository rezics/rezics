"use client";

import { canonicalizeContentLanguageTag, type ContentLanguageTag } from "@rezics/content-language";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { withContentLanguage } from "../routing/content-language-route";

export function useRequestedContentLanguage(): ContentLanguageTag | undefined {
	const requestedLanguage = useSearchParams()?.get("language");
	if (!requestedLanguage) return undefined;
	try {
		return canonicalizeContentLanguageTag(requestedLanguage);
	} catch {
		return undefined;
	}
}

export function useContentLanguageNavigation() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useApplicationRouter();
	const serializedSearchParams = searchParams?.toString() ?? "";
	const currentHref = `${pathname}${serializedSearchParams ? `?${serializedSearchParams}` : ""}`;

	const replaceCurrentLanguage = useCallback(
		(language: string | undefined) => {
			const hash = window.location.hash;
			router.replace(withContentLanguage(`${currentHref}${hash}`, language), {
				scroll: false,
			});
		},
		[currentHref, router],
	);
	const pushLanguage = useCallback(
		(href: string, language: string | undefined) => {
			router.push(withContentLanguage(href, language));
		},
		[router],
	);

	return { pushLanguage, replaceCurrentLanguage };
}
