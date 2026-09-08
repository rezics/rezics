import type { DatabaseTransaction } from "../../database";
import { resolveIdentity } from "../../auth/session";
import { runParticipationTransaction } from "../../participation/transaction";
import {
	runWithParticipationAuthority,
	ParticipationDenied,
	type ParticipationAuthority,
} from "../../participation/policy";
import { CatalogAccessDenied, CatalogReferenceNotFound } from "../../catalog/storage";
import { withCatalogViewerPolicy } from "../../catalog/read-policy";
import { ValidationError } from "../errors";

function failure(cause: unknown, read: boolean): never {
	if (cause instanceof CatalogAccessDenied) {
		if (read) throw new CatalogReferenceNotFound();
		throw new ParticipationDenied();
	}
	if (cause instanceof TypeError || cause instanceof RangeError)
		throw new ValidationError({ message: cause.message.slice(0, 512) });
	throw cause;
}

/** Restores request authority inside the exact database transaction used by native owner commands. @internal */
export async function catalogMutation<T>(
	authority: ParticipationAuthority,
	work: (tx: DatabaseTransaction, actor: string) => Promise<T>,
): Promise<T> {
	try {
		return await runWithParticipationAuthority(authority, () =>
			runParticipationTransaction((tx) =>
				withCatalogViewerPolicy(tx, authority.principal.authUserId, () =>
					work(tx, authority.principal.authUserId),
				),
			),
		);
	} catch (cause) {
		return failure(cause, false);
	}
}

/** Public reads may use a current account's private view preferences without exposing that account. @internal */
export async function catalogRead<T>(
	request: Request,
	work: (tx: DatabaseTransaction, actor: string | null) => Promise<T>,
): Promise<T> {
	const identity = await resolveIdentity(request, "unit:read");
	const authority = "participation" in identity ? identity.participation : undefined;
	const actor = authority?.principal.authUserId ?? null;
	const execute = () =>
		runParticipationTransaction((tx) => withCatalogViewerPolicy(tx, actor, () => work(tx, actor)));
	try {
		return authority ? await runWithParticipationAuthority(authority, execute) : await execute();
	} catch (cause) {
		return failure(cause, true);
	}
}
