import { Surreal } from "surrealdb";
import { surrealdbNodeEngines } from "@surrealdb/node";

const db = new Surreal({
    engines: surrealdbNodeEngines(),
});

db.connect("mem://");

const result = await db.query("DEFINE TABLE TEST SCHEMAFULL");
