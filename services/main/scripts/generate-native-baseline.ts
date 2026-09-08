import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { exportDatabaseSchema } from "./export-database-schema";
import { PostgreSqlSchemaFileNames } from "../src/services/database/schema/postgres/manifest";
import { composeMigrationSql } from "./generate-database-migration";

const serviceRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const repositoryRoot=resolve(serviceRoot,"../..");
const relativeDirectory="services/main/src/services/database/migrations";
const configuration=z.strictObject({
 epoch:z.literal("operational-native-20260908"),
 migration:z.literal("20260908000000_operational_target_baseline.sql"),
 replacedHistoryCommit:z.string().regex(/^[0-9a-f]{40}$/u),
 installation:z.literal("fresh-database"),
}).parse(JSON.parse(await readFile(join(serviceRoot,"src/services/database/baseline.json"),"utf8")));
function git(args:string[]) {
 return spawnSync("git",args,{cwd:repositoryRoot,encoding:"utf8",windowsHide:true});
}
const tags=git(["tag","--list","v*"]);
if(tags.status!==0)throw new Error(tags.stderr || "Cannot inspect released baselines");
for(const tag of tags.stdout.split(/\r?\n/u).filter(value=>/^v\d+\.\d+\.\d+$/u.test(value))) {
 if(git(["cat-file","-e",`${tag}:${relativeDirectory}/${configuration.migration}`]).status===0)
  throw new Error(`The native baseline is released in ${tag}; use a forward migration`);
}
if(git(["cat-file","-e",`${configuration.replacedHistoryCommit}^{commit}`]).status!==0)
 throw new Error("The replaced history recovery commit is unavailable");
const directory=join(repositoryRoot,relativeDirectory);
await mkdir(directory,{recursive:true});
const migrations=(await readdir(directory)).filter(file=>file.endsWith(".sql"));
if(migrations.some(file=>file!==configuration.migration))
 throw new Error("Fresh baseline generation requires an empty chain or only its unreleased baseline");
const work=await mkdtemp(join(repositoryRoot,".temp/native-baseline-"));
try {
 const source=composeMigrationSql({
  preOverlay:"CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA public; CREATE SCHEMA IF NOT EXISTS approx_count; CREATE EXTENSION IF NOT EXISTS approx_count WITH SCHEMA approx_count;",
  schemaDiff:await exportDatabaseSchema(),
  canonicalSql:(await Promise.all(PostgreSqlSchemaFileNames.map(name=>readFile(join(serviceRoot,"src/services/database/schema/postgres",name),"utf8")))).join("\n\n"),
 });
 const draft=join(work,configuration.migration);
 await writeFile(draft,source,"utf8");
 await rename(draft,join(directory,configuration.migration));
 const hash=spawnSync(process.platform==="win32"?"yarn.cmd":"yarn",["exec","atlas","migrate","hash","--env","main"],{cwd:serviceRoot,stdio:"inherit",shell:process.platform==="win32",windowsHide:true});
 if(hash.status!==0)throw new Error("Native baseline checksum generation failed");
 console.log(`Generated fresh native baseline ${configuration.migration}; run db:check before acceptance.`);
}finally{
 if(!work.startsWith(join(repositoryRoot,".temp")+"\\")&&!work.startsWith(join(repositoryRoot,".temp")+"/"))throw new Error("Invalid temporary baseline path");
 await rm(work,{recursive:true,force:true});
}
