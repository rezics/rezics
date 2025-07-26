import { type Client as GelClient } from "gel";
import { type initServer } from "@ts-rest/fastify";

export type Dependencies = {
    gel: GelClient;
    tsr: ReturnType<typeof initServer>;
};

export const setup =
    <T>(fn: (dependencies: Dependencies) => T) =>
    (dependencies: Dependencies) => {
        return fn(dependencies);
    };
