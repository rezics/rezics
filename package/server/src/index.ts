import { initServer } from "@ts-rest/fastify";
import c from "contract";
import fastify from "fastify";

const server = initServer();
const router = server.router(c.Homepage, {
	get: async () => {
		const homePageData = {
			id: crypto.randomUUID(),
			content: "Hello, world!"
		};

		return {
			status: 200,
			body: homePageData,
		};
	}
});

const app = fastify({ logger: true });
app.register(server.plugin(router));

const host = process.env['WEBSERVER_HOST'] || '0.0.0.0';
const port = process.env['WEBSERVER_PORT'] ? parseInt(process.env['WEBSERVER_PORT']) : 3000;

console.log(`Starting server on ${host}:${port}`);

await app.listen({ host, port });
