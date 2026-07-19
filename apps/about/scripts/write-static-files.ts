import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSitemapXml } from "../src/sitemap";

const clientDirectory = resolve("dist/client");
const serverDirectory = resolve("dist/server");
await mkdir(clientDirectory, { recursive: true });
await Promise.all([
	writeFile(resolve(clientDirectory, "sitemap.xml"), createSitemapXml(), "utf8"),
	rm(serverDirectory, { recursive: true, force: true }),
]);
