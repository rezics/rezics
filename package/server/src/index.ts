import { initServer } from "@ts-rest/fastify";
import c from "contract";
import d from "database";
import Fastify from "fastify";
import { Config } from "./config";

const main = async () => {
    const { host, port } = Config.parse(process.env);
    const f = Fastify({ logger: true });
    const s = initServer();

    const r = s.router(c, {});

    f.register(s.plugin(r));

    f.listen({
        host,
        port,
    });
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
