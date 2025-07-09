import { Surreal } from "surrealdb";
import { surrealdbWasmEngines } from "@surrealdb/wasm";
import * as CLI from "@effect/cli";

const main = async (argv: string[]) => {
    const db = new Surreal({
        engines: surrealdbWasmEngines(),
    });

    await Promise.all([db.connect("mem://", { namespace: "root", database: "root" }), db.ready]);

    const info = await db.version();

    console.log(info);
};

main(process.argv.slice(2)).catch(console.error);
