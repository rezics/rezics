import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { ContentPackInvalid } from "./errors";
import type {
	IdLedger,
	LoadedPack,
	PackManifest,
	PackObject,
	PackRelations,
	PackStructure,
	RightsRecord,
} from "./contracts";

export async function listPackIds(packsRoot: string): Promise<string[]> {
	const entries = await readdir(join(packsRoot, "packs"), { withFileTypes: true });
	return entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

export async function loadPack(packsRoot: string, packId: string): Promise<LoadedPack> {
	const packDir = join(packsRoot, "packs", packId);
	const manifest = await readJson<PackManifest>(join(packDir, "pack.json"));
	if (manifest.id !== packId)
		throw new ContentPackInvalid(`pack.json id ${manifest.id} does not match directory ${packId}`);
	if (!manifest.version) throw new ContentPackInvalid(`${packId} is missing version`);
	const ids = await readJson<IdLedger>(join(packDir, "ids.json"));
	if (!ids.units || Object.keys(ids.units).length === 0)
		throw new ContentPackInvalid(`${packId} ids.json has no units`);
	const rights = await readJson<RightsRecord[]>(join(packDir, "rights.json"));
	const contentDir = join(packDir, "content");
	const objects = await readAllObjects(contentDir);
	const relations = await readOptionalJson<PackRelations>(join(contentDir, "relations.json"), {
		unitVariants: [],
		credits: [],
		subjects: [],
		seriesReleases: [],
		collectionItems: [],
		unitTags: [],
		realmUnits: [],
		slugs: [],
	});
	const structures = await readOptionalJson<PackStructure[]>(
		join(contentDir, "structures.json"),
		[],
	);
	const checksum = await hashPack(packDir);
	return { packDir, manifest, checksum, ids, rights, objects, relations, structures };
}

async function readAllObjects(contentDir: string): Promise<PackObject[]> {
	const files = [
		"realm.json",
		"zones.json",
		"zone-pages.json",
		"series.json",
		"books.json",
		"media.json",
		"software.json",
		"releases.json",
		"video.json",
		"audio.json",
		"entities.json",
		"tags.json",
		"posts.json",
		"labels.json",
		"collections.json",
	];
	const objects: PackObject[] = [];
	for (const file of files) {
		const parsed = await readOptionalJson<PackObject[]>(join(contentDir, file), []);
		objects.push(...parsed);
	}
	const chapterDir = join(contentDir, "chapters");
	try {
		for (const name of await readdir(chapterDir)) {
			if (!name.endsWith(".json")) continue;
			objects.push(await readJson<PackObject>(join(chapterDir, name)));
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	return objects;
}

async function hashPack(packDir: string): Promise<string> {
	const hash = createHash("sha256");
	for (const name of ["pack.json", "ids.json", "rights.json", "sources.lock.json"]) {
		hash.update(name);
		hash.update(await readFile(join(packDir, name)));
	}
	const contentDir = join(packDir, "content");
	for (const filePath of await listFilesRecursively(contentDir)) {
		const name = relative(packDir, filePath).replaceAll("\\", "/");
		hash.update(name);
		hash.update(await readFile(filePath));
	}
	return hash.digest("hex");
}

async function listFilesRecursively(directory: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await listFilesRecursively(path)));
		else if (entry.isFile()) files.push(path);
	}
	return files.sort((left, right) => left.localeCompare(right));
}

async function readJson<T>(filePath: string): Promise<T> {
	return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readOptionalJson<T>(filePath: string, fallback: T): Promise<T> {
	try {
		return await readJson<T>(filePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
		throw error;
	}
}
