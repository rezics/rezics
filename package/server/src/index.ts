import { createClient } from "gel";
import e from "../database/ts/index";
import { contract, ts_fastify } from "contract";
import Fastify from "fastify";

const client = createClient();

const app = Fastify({ logger: true });

const host = process.env['WEBSERVER_HOST'] || '0.0.0.0';
const port = process.env['WEBSERVER_PORT'] ? parseInt(process.env['WEBSERVER_PORT']) : 3000;
await app.listen({ host, port });
