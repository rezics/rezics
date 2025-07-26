import c from "contract";
import Fastify from "fastify";
import { initServer } from "@ts-rest/fastify";
import { Config } from "./config";

import Book from "./router/Book";
import Chapter from "./router/Chapter";
import Tag from "./router/Tag";
import User from "./router/User";
import Author from "./router/Author";
import Permission from "./router/Permission";
import PublishInfo from "./router/PublishInfo";
import { createClient } from "gel";
import { Dependencies } from "./router/setup";
import { objectMap } from "./util/objectMap";
import { graphql } from "graphql";

graphql(`
    query {
        books {
            id
            title
            author {
                id
                name
            }
        }
    }
`);

const main = async () => {
    const { host, port } = Config.parse(process.env);
    const f = Fastify({ logger: true });
    const g = createClient();
    const s = initServer();

    const dependencies: Dependencies = {
        gel: g,
        tsr: s,
    };

    const r = s.router(
        c,
        objectMap(
            { User, Tag, Chapter, Book, Author, Permission, PublishInfo },
            (value) => value(dependencies),
        ),
    );

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
