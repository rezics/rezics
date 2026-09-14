import assert from "node:assert/strict";
import { createServer } from "node:https";
import { readFile } from "node:fs/promises";
import { TLSSocket } from "node:tls";

const directory = process.env.REZICS_CIMD_FIXTURE_DIRECTORY;
assert.ok(directory?.includes("/.temp/cimd-transport."));
assert.equal(
	process.versions.bun,
	undefined,
	"Use an independent Node TLS peer to observe Bun's ClientHello",
);
const server = createServer(
	{
		key: await readFile(`${directory}/key.pem`),
		cert: await readFile(`${directory}/cert.pem`),
	},
	(request, response) => {
		assert.ok(request.socket instanceof TLSSocket);
		response.end(
			JSON.stringify({ servername: request.socket.servername, node: process.versions.node }),
		);
	},
);
server.listen(0, "8.8.8.8", () => {
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	console.info(JSON.stringify({ port: address.port }));
});
