import { z } from "zod";

const integer = (minimum: number, maximum: number) =>
	z.coerce.number().int().min(minimum).max(maximum);
/** Process configuration is operator input, never source content. @internal */
export function parseEventWorkerConfig(environment: Record<string, string | undefined>) {
	const config = z
		.object({
			NATS_URL: z.string().url(),
			EVENT_WORKER_BUCKETS: z
				.string()
				.regex(/^\d+(,\d+)*$/)
				.transform((value) => value.split(",").map(Number))
				.pipe(z.array(z.number().int().min(0).max(1023)).min(1).max(16))
				.refine((values) => new Set(values).size === values.length),
			EVENT_WORKER_EPOCH: integer(1, Number.MAX_SAFE_INTEGER).default(1),
			EVENT_WORKER_DEPLOYMENT: z.enum(["qualification", "production"]).default("qualification"),
			EVENT_WORKER_STREAM_BYTES: integer(65536, Number.MAX_SAFE_INTEGER),
			EVENT_WORKER_STREAM_MESSAGES: integer(1, Number.MAX_SAFE_INTEGER),
			EVENT_WORKER_HEALTH_HOST: z.enum(["127.0.0.1", "::1"]).default("127.0.0.1"),
			EVENT_WORKER_HEALTH_PORT: integer(1024, 65535).default(3032),
			EVENT_WORKER_RELAY: z.enum(["sql", "external"]).default("external"),
			EVENT_WORKER_POLL_MS: integer(50, 30000).default(250),
		})
		.parse(environment);
	const nats = new URL(config.NATS_URL);
	if (!["nats:", "tls:"].includes(nats.protocol))
		throw new TypeError("NATS_URL must use nats or tls");
	if (config.EVENT_WORKER_DEPLOYMENT === "production" && nats.protocol !== "tls:")
		throw new TypeError("Production event workers require TLS");
	return config;
}
