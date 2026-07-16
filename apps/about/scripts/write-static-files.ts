import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createSitemapXml } from "../src/sitemap";

const clientDirectory = resolve("dist/client");
await mkdir(clientDirectory, { recursive: true });
await writeFile(resolve(clientDirectory, "sitemap.xml"), createSitemapXml(), "utf8");
