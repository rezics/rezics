"use client";

import {
	getFeedFixtureData,
	type FeedFixtureData,
	type FixtureContentLanguage,
} from "@rezics/fixture-data";
import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface FixtureClientValue {
	readonly contentLanguage: FixtureContentLanguage;
	readonly feed: FeedFixtureData;
}

const FixtureClientContext = createContext<FixtureClientValue | null>(null);

export function FixtureProvider({
	children,
	contentLanguage,
}: {
	readonly children: ReactNode;
	readonly contentLanguage: FixtureContentLanguage;
}) {
	const value = useMemo<FixtureClientValue>(
		() => ({
			contentLanguage,
			feed: getFeedFixtureData(contentLanguage),
		}),
		[contentLanguage],
	);

	return <FixtureClientContext.Provider value={value}>{children}</FixtureClientContext.Provider>;
}

export function useFixtureClient(): FixtureClientValue {
	const value = useContext(FixtureClientContext);
	if (!value) throw new Error("useFixtureClient must be used within FixtureProvider.");
	return value;
}

export function useFeedFixtureData(): FeedFixtureData {
	return useFixtureClient().feed;
}
