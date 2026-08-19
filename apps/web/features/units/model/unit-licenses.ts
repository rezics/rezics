import {
	isLicenseId,
	LicenseRegistry,
	ResidualRightsLicenseId,
	type LicenseId,
} from "@rezics/license";

export function reconcileLicenseSelection(input: {
	readonly allowProfileOwnedOnly: boolean;
	readonly initial: readonly LicenseId[];
	readonly previous: readonly LicenseId[];
	readonly next: readonly string[];
}): LicenseId[] {
	const initial = new Set(input.initial);
	const protectedInitial = input.initial.filter(
		(id) => LicenseRegistry[id].profileOwnedOnly && !input.allowProfileOwnedOnly,
	);
	const licenses = [...new Set([...protectedInitial, ...input.next.filter(isLicenseId)])].filter(
		(id) =>
			input.allowProfileOwnedOnly ||
			!LicenseRegistry[id].profileOwnedOnly ||
			protectedInitial.includes(id),
	);
	const addedResidual =
		licenses.includes(ResidualRightsLicenseId) && !input.previous.includes(ResidualRightsLicenseId);
	if (!addedResidual) return licenses;
	return [
		ResidualRightsLicenseId,
		...licenses.filter((id) => id !== ResidualRightsLicenseId && initial.has(id)),
	];
}

export function readSubmittedLicenses(form: FormData, name = "licenses"): LicenseId[] {
	return [
		...new Set(
			form
				.getAll(name)
				.filter((value): value is string => typeof value === "string")
				.filter(isLicenseId),
		),
	];
}
