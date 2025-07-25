import { initServer } from "@ts-rest/fastify";
import c from "contract";
import Fastify from "fastify";
import s from "./router/s";
import d from "database";
import { Config } from "./config";
import Auth from "./router/Auth";
import Book from "./router/Book";
import Tag from "./router/Tag";
import Chapter from "./router/Chapter";
import Homepage from "./router/Homepage";

const main = async () => {
    const { host, port } = Config.parse(process.env);
    const f = Fastify({ logger: true });

    const r = s.router(c, {
        Auth,
        Book,
        Tag,
        Chapter,
        Homepage,
    });

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
