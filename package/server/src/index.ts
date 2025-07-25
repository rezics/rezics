import c from "contract";
import Fastify from "fastify";
import s from "./router/s";
import { Config } from "./config";

// Import all router handlers
import Auth from "./router/Auth";
import Book from "./router/Book";
import Tag from "./router/Tag";
import HomePage from "./router/Homepage";
import Chapter from "./router/Chapter";

const main = async () => {
    const { host, port } = Config.parse(process.env);
    const f = Fastify({ logger: true });

    // Setup CORS for web client
    await f.register(import("@fastify/cors"), {
        origin: true,
        credentials: true,
    });

    // Register JSON parser
    await f.register(import("@fastify/formbody"));

    const r = s.router(c, {
        Auth,
        Book,
        Tag,
        Homepage: HomePage,
        Chapter,
    });

    f.register(s.plugin(r));

    f.listen({
        host,
        port,
    });

    console.log(`Server listening on ${host}:${port}`);
};

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
