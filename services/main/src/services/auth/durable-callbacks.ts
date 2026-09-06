import type { BetterAuthPlugin } from "better-auth";

/**
 * Keep authentication's durable writes inside the acknowledged request lifetime.
 * @internal
 */
export const durableAuthenticationCallbacks = {
	id: "rezics-durable-authentication-callbacks",
	init() {
		return {
			context: {
				// Better Auth 1.7.2's default helper awaits but swallows callback errors.
				// Our callbacks enqueue locally; external delivery belongs to the worker.
				async runInBackgroundOrAwait(promise: Promise<unknown> | void) {
					await promise;
				},
			},
		};
	},
} satisfies BetterAuthPlugin;
