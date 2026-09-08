import assert from "node:assert/strict";
import Elysia from "elysia";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "../src/services/database/schema/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { CatalogCreatedSchema, CatalogMutationSchema, CatalogNameCreatedSchema } from "../src/services/catalog/resource-contracts";

const url = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
if (process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1" || !url ||
 !["localhost","127.0.0.1","[::1]"].includes(url.hostname) || url.port === "15432" ||
 !/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname)) throw new Error("Explicit isolated loopback Atlas fixture required");
const observability = initializeObservability({service:{name:"rezics-native-search-fixture",version:"1.0.0",environment:"tooling"}});
const {database}=await import("../src/services/database");
const {auth}=await import("../src/services/auth");
const {default:catalog}=await import("../src/services/api/catalog");
const {default:errors}=await import("../src/services/api/error-boundary");
const {searchDomain,searchGrouped}=await import("../src/services/search/service");
const api=new Elysia({prefix:"/api/v1"}).use(errors).use(catalog);api.compile();
const context=await auth.$context;
const accounts:string[]=[];
let assertions=0;
async function request(path:string,body:unknown,cookie:string,method="POST") {
 const response=await api.fetch(new Request("http://localhost:3001/api/v1"+path,{method,headers:{"content-type":"application/json",Cookie:cookie},body:JSON.stringify(body)}));
 const content=await response.text();assert.equal(response.status,200,`${method} ${path}: ${content}`);assertions++;
 return JSON.parse(content) as unknown;
}
try {
 const account=await database.transaction(async tx=>{const [row]=await tx.insert(users).values({name:"Native search fixture",email:`${crypto.randomUUID()}@example.invalid`,emailVerified:true}).returning();assert.ok(row);await ensureSelfEntityInTransaction(tx,row);return row;});
 accounts.push(account.id);
 const session=await context.internalAdapter.createSession(account.id);
 const [cookie]= (await serializeSignedCookie(context.authCookies.sessionToken.name,session.token,context.secret,{path:"/"})).split(";");assert.ok(cookie);
 const token="NativeSearch"+crypto.randomUUID().replaceAll("-","");
 const resources=[];
 for(const kind of ["publishing_work","publishing_work","text_version","recording","software_content"] as const){
  const created=CatalogCreatedSchema.parse(await request("/catalog/resources",{kind,name:{languageTag:"en",value:token},...(kind==="text_version"?{languageTag:"ja"}:{})},cookie));
  const path=`/catalog/resources/${created.reference.owner}/${created.reference.id}`;
  const mutation=CatalogMutationSchema.parse(await request(path+"/lifecycle",{expectedRevision:created.revision,status:"published",visibility:"public",contentRating:"general"},cookie,"PATCH"));
  resources.push({...created,revision:mutation.revision});
 }
 const privateWork=CatalogCreatedSchema.parse(await request("/catalog/resources",{kind:"publishing_work",name:{languageTag:"en",value:token}},cookie));
 const first=await searchDomain("units",{query:token,owners:["publishing"],shapes:["work"],sort:"relevance",limit:1});
 assert.equal(first.hits.length,1);assert.equal(first.hits[0]?.owner,"publishing");assert.equal(first.hits[0]?.shape,"work");assert.ok(first.nextCursor);assertions+=4;
 const second=await searchDomain("units",{query:token,owners:["publishing"],shapes:["work"],sort:"relevance",limit:1,cursor:first.nextCursor});
 assert.equal(second.hits.length,1);assert.notEqual(second.hits[0]?.id,first.hits[0]?.id);assert.equal(second.nextCursor,undefined);assertions+=3;
 const all=await searchDomain("units",{query:token,sort:"relevance",limit:20});
 assert.equal(all.hits.length,5);assert.equal(all.hits.some(hit=>hit.id===privateWork.reference.id),false);assertions+=2;
 const grouped=await searchGrouped({indexes:["units"],query:token,owners:["publishing"],shapes:["text_version"],localizationLanguages:[],limitPerIndex:1});
 assert.equal(grouped.groups[0]?.hits[0]?.shape,"text_version");assertions++;
 const best=await searchDomain("units",{query:token,owners:["publishing"],shapes:["work"],sort:"best",limit:10});
 assert.equal(best.hits.length,2);assertions++;
 const target=resources[0]!;let revision=target.revision;
 for(let index=0;index<34;index++){
  const name=CatalogNameCreatedSchema.parse(await request(`/catalog/resources/publishing/${target.reference.id}/names`,{expectedRevision:revision,value:{languageTag:"en",kind:"title",value:`Display alias ${index}`}},cookie));revision=name.revision;
 }
 const preferred="Preferred "+token;
 await request(`/catalog/resources/publishing/${target.reference.id}/names`,{expectedRevision:revision,value:{languageTag:"ja",kind:"title",value:preferred,primaryForLanguage:true}},cookie);
 const localized=await searchDomain("units",{query:token,owners:["publishing"],shapes:["work"],localizationLanguages:["ja"],limit:10});
 assert.equal(localized.hits.find(hit=>hit.id===target.reference.id)?.title,preferred);assertions++;
 const budget=await database.execute(sql`select * from public.search_catalog_name_candidates('publishing',array[${token}]::text[],array[]::text[],array['work']::text[],null::bigint,null::uuid,1,3)`);
 const budgetRows=z.array(z.object({unit_id:z.uuid(),search_matched:z.boolean()})).parse(budget.rows);
 assert.ok(budgetRows.length<=3);assert.ok(budgetRows.every(row=>row.search_matched===false));assertions+=2;
 const before=await database.execute(sql`select owner_id from publishing_named_form where value=${token} and state='active' and spoiler=0 and scope_owner_id is null`);
 assert.ok(before.rows.length>=3);assertions++;
 const hidden=resources[1]!;
 await request(`/catalog/resources/publishing/${hidden.reference.id}/lifecycle`,{expectedRevision:hidden.revision,status:"published",visibility:"private",contentRating:"general"},cookie,"PATCH");
 const after=await searchDomain("units",{query:token,owners:["publishing"],shapes:["work"],limit:10});
 assert.equal(after.hits.some(hit=>hit.id===hidden.reference.id),false);assertions++;
 console.log(JSON.stringify({check:"native-search",assertions,committedToDisposableTarget:true}));
} finally {
 if(accounts.length)await database.delete(sessions).where(inArray(sessions.userId,accounts));
 await database.$client.end();await observability.shutdown();
}
