import { z } from "zod";

export const Config = z.preprocess(
    (config: any) =>
        Object.entries(config || {}).reduce((acc, [key, value]) => {
            return {
                ...acc,
                [key.toLowerCase()]: value,
            };
        }, {}),
    z
        .object({
            host: z.string().default("localhost"),
            port: z.coerce.number().min(1).max(65535).default(3000),
        })
        .passthrough(),
);
