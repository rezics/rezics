import {
	createClient,
	type SelectParticipationStatus200,
	type ListMembershipManagedOrganizationsStatus200,
} from "@rezics/openapi-tanstack-query";

export type ParticipationSelection = Pick<SelectParticipationStatus200, "actingEntityId" | "grant">;

/** Each operation keeps its explicit grant; creating this client never changes shared account requests. */
export function createParticipationClient(selection: ParticipationSelection) {
	return createClient({
		options: { credentials: "include" },
		...(selection.grant
			? {
					headers: {
						"X-Rezics-Participation": JSON.stringify({
							actingEntityId: selection.actingEntityId,
							grant: selection.grant,
						}),
					},
				}
			: {}),
	});
}

/** Org membership requests use explicit native authority without mutating the account's default. */
export function createMembershipClient(
	value: Pick<ListMembershipManagedOrganizationsStatus200["items"][number], "selection">,
) {
	return createClient({
		options: { credentials: "include" },
		headers: { "X-Rezics-Authority": JSON.stringify(value.selection) },
	});
}
