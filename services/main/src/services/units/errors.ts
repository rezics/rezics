import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";
import type { ContentLanguage } from "@rezics/i18n";

export class UnitNotFound extends HTTPError.id("UnitNotFound", StatusCodes.NOT_FOUND) {
	override readonly message: string;

	constructor(kind?: string) {
		super();
		this.message = kind ? `${kind} not found` : "Unit not found";
	}
}

export class UnitPermissionForbidden extends HTTPError.id(
	"UnitPermissionForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message: string;
	readonly details: { readonly permission: string; readonly scope: string[] };

	constructor(permission: string, scope: readonly string[]) {
		super();
		this.message = `Unit permission required: ${permission}`;
		this.details = { permission, scope: [...scope] };
	}
}

export class UnitAccessRestricted extends HTTPError.id(
	"UnitAccessRestricted",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "Your access to this Unit scope is restricted";
}

export class UnitLicenseGrantForbidden extends HTTPError.id(
	"UnitLicenseGrantForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "The requested License cannot be granted by this Unit";
}

export class UnitLicenseNotApplicable extends HTTPError.id(
	"UnitLicenseNotApplicable",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "This license cannot be granted on this Unit kind";
	readonly details: { readonly licenseId: string; readonly unitKind: string };

	constructor(licenseId: string, unitKind: string) {
		super();
		this.details = { licenseId, unitKind };
	}
}

export class UnitLicenseOfferingEndForbidden extends HTTPError.id(
	"UnitLicenseOfferingEndForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "This license offering cannot be ended";
	readonly details: { readonly licenseId: string };

	constructor(licenseId: string) {
		super();
		this.details = { licenseId };
	}
}

export class UnitLicenseGrantConflict extends HTTPError.id(
	"UnitLicenseGrantConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "An open offering for this license already exists on the Unit";
}

export class UnitChanged extends HTTPError.id("UnitChanged", StatusCodes.CONFLICT) {
	override readonly message = "Unit has changed";
	readonly details: { readonly updatedAt: string };

	constructor(updatedAt: Date) {
		super();
		this.details = { updatedAt: updatedAt.toISOString() };
	}
}

export class UnitContentLanguageSupportInvalid extends HTTPError.id(
	"UnitContentLanguageSupportInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Unit content language support is invalid";
	readonly details: { readonly path: string; readonly reason: string };

	constructor(path: string, reason: string) {
		super();
		this.details = { path, reason };
	}
}

export class VideoAudioTrackInvalid extends HTTPError.id(
	"VideoAudioTrackInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "The selected Audio tracks could not be saved";
	readonly details: { readonly path: string; readonly reason: string };

	constructor(path: string, reason: string) {
		super();
		this.details = { path, reason };
	}
}

export class UnitRealmPublicationNotFound extends HTTPError.id(
	"UnitRealmPublicationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit Realm publication was not found";
}

export class UnitRealmPublicationAlreadyExists extends HTTPError.id(
	"UnitRealmPublicationAlreadyExists",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit Realm publication already exists";
}

export class UnitRealmPublicationTransitionInvalid extends HTTPError.id(
	"UnitRealmPublicationTransitionInvalid",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit Realm publication is already in the requested state";
	readonly details: { readonly publicationState: "active" | "withdrawn" };

	constructor(publicationState: "active" | "withdrawn") {
		super();
		this.details = { publicationState };
	}
}

export class UnitRevisionConflict extends HTTPError.id(
	"UnitRevisionConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit revision has changed";
	readonly details: {
		readonly latestRevisionId: string | null;
		readonly conflictPaths: string[];
	};

	constructor(latestRevisionId: string | null, conflictPaths: readonly string[] = []) {
		super();
		this.details = { latestRevisionId, conflictPaths: [...conflictPaths] };
	}
}

export class RevisionCreditEntityInvalid extends HTTPError.id(
	"RevisionCreditEntityInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "The credited revision Entity is unavailable or not a software agent";
}

export class RevisionContributionActorRequired extends HTTPError.id(
	"RevisionContributionActorRequired",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "A human or AI revision contribution requires an accountable actor";
}

export class UnitLocalizationOrderChanged extends HTTPError.id(
	"UnitLocalizationOrderChanged",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unit content language order has changed";
	readonly details: { readonly currentLanguages: ContentLanguage[] };

	constructor(currentLanguages: readonly ContentLanguage[]) {
		super();
		this.details = { currentLanguages: [...currentLanguages] };
	}
}

export class UnitLocalizationOrderInvalid extends HTTPError.id(
	"UnitLocalizationOrderInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message =
		"Content language order must contain every existing Unit language exactly once";
}

export class UnitLocalizationNotFound extends HTTPError.id(
	"UnitLocalizationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit content language was not found";
}

export class UnitLastLocalizationRemovalForbidden extends HTTPError.id(
	"UnitLastLocalizationRemovalForbidden",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A Unit must keep at least one content language";
}

export class UnitVariantKindMismatch extends HTTPError.id(
	"UnitVariantKindMismatch",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A Variant and its Main must have the same supported Unit kind";
}

export class UnitVariantTargetIsVariant extends HTTPError.id(
	"UnitVariantTargetIsVariant",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A Variant must point directly to a Main";
}

export class UnitVariantSourceHasVariants extends HTTPError.id(
	"UnitVariantSourceHasVariants",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A Main with Variants cannot become a Variant through this operation";
}

export class UnitVariantGroupLimitReached extends HTTPError.id(
	"UnitVariantGroupLimitReached",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Main Unit has reached the supported Variant group size";
}

export class UnitVariantChanged extends HTTPError.id("UnitVariantChanged", StatusCodes.CONFLICT) {
	override readonly message = "The Unit Main relationship has changed";
	readonly details: { readonly currentMainUnitId: string | null };

	constructor(currentMainUnitId: string | null) {
		super();
		this.details = { currentMainUnitId };
	}
}

export class UnitVariantMainUnavailable extends HTTPError.id(
	"UnitVariantMainUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Main is unavailable for this Variant state";
}

export class InvalidSlug extends HTTPError.id("InvalidSlug", StatusCodes.BAD_REQUEST) {
	override readonly message =
		"Slug must be a lowercase ASCII kebab label between 1 and 63 characters";
}

export class SlugTaken extends HTTPError.id("SlugTaken", StatusCodes.CONFLICT) {
	override readonly message = "Slug is already used in this Unit scope";
	readonly details: { readonly scopeUnitId: string | null; readonly slug: string };

	constructor(scopeUnitId: string | null, slug: string) {
		super();
		this.details = { scopeUnitId, slug };
	}
}

export class SlugReserved extends HTTPError.id("SlugReserved", StatusCodes.UNPROCESSABLE_ENTITY) {
	override readonly message = "Slug is reserved from self-service assignment";
	readonly details: { readonly slug: string };

	constructor(slug: string) {
		super();
		this.details = { slug };
	}
}

export class ProfileSlugChangeUnavailable extends HTTPError.id(
	"ProfileSlugChangeUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "The Profile slug cannot be changed after assignment";
}

export class SlugScopeNotFound extends HTTPError.id("SlugScopeNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Slug scope Unit not found";
}

export class SlugScopeUnavailable extends HTTPError.id(
	"SlugScopeUnavailable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Unaddressed and deleted Units cannot be canonical slug scopes";
}

export class SlugScopeCycle extends HTTPError.id("SlugScopeCycle", StatusCodes.CONFLICT) {
	override readonly message = "Moving this Unit would create a slug scope cycle";
}

export class SlugDepthExceeded extends HTTPError.id(
	"SlugDepthExceeded",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Unit slug path exceeds the maximum depth";
}

export class UnitAddressMutationForbidden extends HTTPError.id(
	"UnitAddressMutationForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message = "This Unit address cannot be mutated by this operation";
}

export class SlugRedirectNotFound extends HTTPError.id(
	"SlugRedirectNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Slug Redirect not found";
}

export class UnitSlugAddressNotFound extends HTTPError.id(
	"UnitSlugAddressNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Unit has no canonical slug address";
}

export class AssociationProposalNotFound extends HTTPError.id(
	"AssociationProposalNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Association proposal not found";
}

export class AssociationProposalConflict extends HTTPError.id(
	"AssociationProposalConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Association proposal conflicts with the current relationship state";
}

export class AssociationProposalExpired extends HTTPError.id(
	"AssociationProposalExpired",
	StatusCodes.CONFLICT,
) {
	override readonly message = "Association proposal has expired";
}

export class AssociationProposalExpiryInvalid extends HTTPError.id(
	"AssociationProposalExpiryInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Association proposal expiry must be in the future";
}

export class AssociationProposalRoleInvalid extends HTTPError.id(
	"AssociationProposalRoleInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Association proposal role does not match its kind";
}

export class AssociationContextPostInvalid extends HTTPError.id(
	"AssociationContextPostInvalid",
	StatusCodes.BAD_REQUEST,
) {
	override readonly message = "Subject association context must be a wiki Post";
}

export const UnitErrors = [
	UnitNotFound,
	UnitPermissionForbidden,
	UnitAccessRestricted,
	UnitLicenseGrantForbidden,
	UnitLicenseNotApplicable,
	UnitLicenseOfferingEndForbidden,
	UnitLicenseGrantConflict,
	UnitChanged,
	UnitContentLanguageSupportInvalid,
	VideoAudioTrackInvalid,
	UnitRealmPublicationNotFound,
	UnitRealmPublicationAlreadyExists,
	UnitRealmPublicationTransitionInvalid,
	UnitRevisionConflict,
	RevisionCreditEntityInvalid,
	RevisionContributionActorRequired,
	UnitLocalizationOrderChanged,
	UnitLocalizationOrderInvalid,
	UnitLocalizationNotFound,
	UnitLastLocalizationRemovalForbidden,
	UnitVariantKindMismatch,
	UnitVariantTargetIsVariant,
	UnitVariantSourceHasVariants,
	UnitVariantGroupLimitReached,
	UnitVariantChanged,
	UnitVariantMainUnavailable,
	InvalidSlug,
	SlugTaken,
	SlugReserved,
	ProfileSlugChangeUnavailable,
	SlugScopeNotFound,
	SlugScopeUnavailable,
	SlugScopeCycle,
	SlugDepthExceeded,
	UnitAddressMutationForbidden,
	SlugRedirectNotFound,
	UnitSlugAddressNotFound,
	AssociationProposalNotFound,
	AssociationProposalConflict,
	AssociationProposalExpired,
	AssociationProposalExpiryInvalid,
	AssociationProposalRoleInvalid,
	AssociationContextPostInvalid,
] as const;
