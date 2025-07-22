import { createClient } from "gel";
import e from "../database/ts/index.js";
import { contract, ts_fastify } from "contract";

const client = createClient();

contract.tag.get();

const server = ts_fastify.initServer();
