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
        })
        .loose(),
);
