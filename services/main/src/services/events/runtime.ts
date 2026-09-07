import { setTimeout as delay } from "node:timers/promises";
import type { Consumer, JetStreamManager } from "@nats-io/jetstream";
import type { DatabaseSession } from "../database";
import { consumeBatch, type EventHandler } from "./consumer";
import { checkConsumerRetention } from "./checkpoint";

/** Health represents active work loops, not merely a listening port. @internal */
export class EventWorkerHealth {
	private lanes = new Map<string, { ok: boolean; updatedAt: number; failure: string | null }>();
	register(name: string) {
		if (this.lanes.size >= 128) throw new RangeError("Too many event worker lanes");
		this.lanes.set(name, { ok: false, updatedAt: Date.now(), failure: null });
	}
	success(name: string) {
		this.lanes.set(name, { ok: true, updatedAt: Date.now(), failure: null });
	}
	fail(name: string, error: unknown) {
		this.lanes.set(name, {
			ok: false,
			updatedAt: Date.now(),
			failure: error instanceof Error ? error.name : "Error",
		});
	}
	snapshot() {
		const lanes = Object.fromEntries(this.lanes);
		return {
			ready:
				this.lanes.size > 0 &&
				[...this.lanes.values()].every((lane) => lane.ok && Date.now() - lane.updatedAt < 60000),
			lanes,
		};
	}
}

/** Persist failures and back off; one failed lane never creates a tight retry loop. @internal */
export async function runEventLane(
	name: string,
	work: () => Promise<unknown>,
	health: EventWorkerHealth,
	signal: AbortSignal,
	pollMs = 250,
): Promise<void> {
	health.register(name);
	let failures = 0;
	while (!signal.aborted) {
		try {
			await work();
			health.success(name);
			failures = 0;
		} catch (error) {
			if (signal.aborted) break;
			health.fail(name, error);
			failures = Math.min(6, failures + 1);
		}
		try {
			await delay(failures ? Math.min(30000, 500 * 2 ** failures) : pollMs, undefined, { signal });
		} catch {
			if (!signal.aborted) throw new Error("Event lane timer failed");
		}
	}
}

/** Every finite pull batch drains in-flight handlers; retention is checked before any new effects. @internal */
export async function runEventConsumer<T>(input: {
	database: DatabaseSession;
	manager: JetStreamManager;
	consumer: Consumer;
	handler: EventHandler<T>;
	health: EventWorkerHealth;
	signal: AbortSignal;
}): Promise<void> {
	const { database, manager, consumer, handler, health, signal } = input;
	return runEventLane(
		`${handler.route.class}.${handler.route.bucket}.${handler.durable}`,
		async () => {
			await checkConsumerRetention(database, manager, handler.route, handler.durable);
			await consumeBatch(consumer, handler, signal);
			await checkConsumerRetention(database, manager, handler.route, handler.durable);
		},
		health,
		signal,
	);
}
