import c from "contract";
import Fastify from "fastify";
import s from "./router/s";
import { Config } from "./config";

// Routers implementation
import Auth from "./router/Auth";
import Book from "./router/Book";
import Tag from "./router/Tag";
import Homepage from "./router/Homepage";
import Chapter from "./router/Chapter";

const main = async () => {
    const { host, port } = Config.parse(process.env);
    const f = Fastify({ logger: true });

    const r = s.router(c, {
        Auth,
        Book,
        Tag,
        Homepage,
        Chapter,
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
