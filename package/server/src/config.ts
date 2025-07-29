import { z } from "zod";

export const Config = z.preprocess(
    (config: object) =>
        Object.entries(config).reduce((acc, [key, value]) => {
            return {
                ...acc,
                [key.toLowerCase()]: value,
            };
        }, {}),
    z
        .object({
            host: z.string().default("localhost"),
            port: z.int().min(1).max(65535).default(3000),
            // Password hashing configuration
            password_hash_algorithm: z.string().default("bf"),
            password_salt_rounds: z.coerce.number().int().min(4).max(31).default(12),
            password_custom_salt: z.string().optional(),
        })
        .loose(),
);
