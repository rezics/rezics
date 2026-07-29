"use client";

import {
	getApiUsersMePreferences,
	type GetApiUsersMePreferencesStatus200,
} from "@rezics/openapi-tanstack-query";
import { skipToken, useQuery, type QueryClient } from "@tanstack/react-query";

import { useHydratedSession } from "@/lib/use-hydrated-session";
import {
	parsePresentationPreferences,
	presentationPreferencesQueryKey,
	type PresentationPreferences,
} from "../model/presentation-preferences";

function selectPresentationPreferences(
	preferences: GetApiUsersMePreferencesStatus200,
): PresentationPreferences {
	const selected = parsePresentationPreferences(preferences);
	if (!selected) throw new Error("The current-user presentation preferences response is invalid");
	return selected;
}

export function usePresentationPreferences() {
	const session = useHydratedSession();
	const profileId = session.data?.user.id ?? null;

	return useQuery({
		queryKey: presentationPreferencesQueryKey(profileId),
		queryFn: profileId
			? async ({ signal }) => {
					const { data } = await getApiUsersMePreferences({ signal, throwOnError: true });
					const preferences = selectPresentationPreferences(data);
					if (preferences.profileId !== profileId)
						throw new Error(
							"The current-user presentation preferences do not match the authenticated profile",
						);
					return preferences;
				}
			: skipToken,
		enabled: Boolean(profileId),
	});
}

export function setPresentationPreferencesQueryData(
	queryClient: QueryClient,
	preferences: GetApiUsersMePreferencesStatus200,
) {
	const selected = selectPresentationPreferences(preferences);
	queryClient.setQueryData(presentationPreferencesQueryKey(selected.profileId), selected);
}
