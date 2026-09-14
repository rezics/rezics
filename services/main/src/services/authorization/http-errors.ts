import { HTTPError } from "elysia";

/** Viewer-safe denial shared by mixed access management surfaces. @alpha */
export class AccessDenied extends HTTPError.id("AccessDenied", 403) {
	override readonly message = "Access denied for this operation";
}
/** Current access could not be established; retry is distinct from denial. @alpha */
export class AccessUnavailable extends HTTPError.id("AccessUnavailable", 503) {
	override readonly message = "Access could not be verified. Try again.";
}
/** The request's expected state or operation identity no longer matches. @alpha */
export class AccessChanged extends HTTPError.id("AccessChanged", 409) {
	override readonly message = "Access or data changed. Reload and try again.";
}
/** A private selector or management input needs a fresh client choice. @alpha */
export class AccessInputInvalid extends HTTPError.id("AccessInputInvalid", 400) {
	override readonly message = "The access request is invalid. Check the selection and try again.";
}
/** Missing and undisclosed management records have the same public representation. @alpha */
export class AccessRecordUnavailable extends HTTPError.id("AccessRecordUnavailable", 404) {
	override readonly message = "The access record is unavailable";
}
/** Public error vocabulary; native evidence and private identities are not serialized. @internal */
export const AccessApiErrors = [AccessDenied, AccessUnavailable, AccessChanged, AccessInputInvalid, AccessRecordUnavailable] as const;
