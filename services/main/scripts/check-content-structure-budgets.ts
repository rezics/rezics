import assert from "node:assert/strict";
import { Pool, type PoolClient } from "pg";
import { fractionalPositionAt } from "@rezics/schema/contracts/native/positions";

const connectionString=process.env.DATABASE_URL;
const target=connectionString && new URL(connectionString);
if(process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE!=="1" || !target ||
 !["localhost","127.0.0.1","[::1]"].includes(target.hostname) || target.port==="15432" ||
 !/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)) throw new Error("Isolated loopback Atlas fixture required");
const pool=new Pool({connectionString,max:3});
const client=await pool.connect();let assertions=0;
async function insertOwnerStructures(count:number) {
 const owners=Array.from({length:count},()=>crypto.randomUUID());
 await client.query("insert into realm(id) select unnest($1::uuid[])",[owners]);
 const structures=await client.query<{id:string}>("insert into content_structure(owner_unit_id,kind,document_key) select unnest($1::uuid[]),'wiki.navigation','001122aabbcc' returning id",[owners]);
 return structures.rows.map(row=>row.id);
}
async function node(db:PoolClient,structureId:string,labelId:string,position="a0") {
 const row=await db.query<{id:string}>("insert into content_structure_node(structure_id,owner_unit_id,content_unit_id,document_key,target_kind,position) select id,owner_unit_id,$2,substr(replace(gen_random_uuid()::text,'-',''),1,12),'content',$3 from content_structure where id=$1 returning id",[structureId,labelId,position]);
 assert.ok(row.rows[0]);return row.rows[0].id;
}
async function rejected(work:()=>Promise<unknown>) {
 await client.query("savepoint rejected_capacity");
 try {await work();throw new Error("Expected capacity rejection");}
 catch(error){assert.equal(typeof error==="object"&&error!==null&&"code"in error?error.code:null,"23514");assertions++;}
 finally {await client.query("rollback to savepoint rejected_capacity");}
}
try {
 await client.query("begin");
 const [structure]=await insertOwnerStructures(1);assert.ok(structure);
 const labels=Array.from({length:2049},()=>crypto.randomUUID());
 await client.query("insert into label(id) select unnest($1::uuid[])",[labels]);
 const positions=Array.from({length:2048},(_,index)=>fractionalPositionAt(index));
 await client.query("insert into content_structure_node(structure_id,owner_unit_id,content_unit_id,document_key,target_kind,position) select s.id,s.owner_unit_id,items.content,substr(replace(gen_random_uuid()::text,'-',''),1,12),'content',items.position from content_structure s cross join unnest($2::uuid[],$3::text[]) items(content,position) where s.id=$1",[structure,labels.slice(0,2048),positions]);
 const total=await client.query<{count:string;slots:string}>("select count(*)::text,count(distinct live_structure_slot)::text slots from content_structure_node where structure_id=$1 and deleted_at is null",[structure]);
 assert.deepEqual(total.rows[0],{count:"2048",slots:"2048"});assertions++;
 await rejected(()=>node(client,structure,labels[2048]!,fractionalPositionAt(2048)));
 const original=await client.query<{id:string}>("update content_structure_node set deleted_at=now() where structure_id=$1 and live_structure_slot=0 returning id",[structure]);
 await node(client,structure,labels[2048]!,fractionalPositionAt(2048));
 await rejected(()=>client.query("update content_structure_node set deleted_at=null where id=$1",[original.rows[0]!.id]));
 await client.query("rollback");

 // Persist only this task's private draft fixture so two transactions exercise the real UNIQUE constraints.
 await client.query("begin");
 const structures=await insertOwnerStructures(65);
 const content=crypto.randomUUID();await client.query("insert into label(id) values($1)",[content]);
 for(const id of structures.slice(0,63)) await node(client,id,content);
 await client.query("set constraints all immediate");await client.query("commit");
 const first=await pool.connect(), second=await pool.connect();
 try {
  await first.query("begin");await second.query("begin");
  await node(first,structures[63]!,content);
  const secondResult=node(second,structures[64]!,content).then(()=>({accepted:true,code:null}),error=>({accepted:false,code:typeof error==="object"&&error!==null&&"code"in error?error.code:null}));
  await first.query("commit");
  assert.deepEqual(await secondResult,{accepted:false,code:"23514"});assertions++;
  await second.query("rollback");
 }finally{first.release();second.release();}
 const placed=await client.query<{count:string}>("select count(*)::text from content_structure_node where content_unit_id=$1 and deleted_at is null",[content]);
 assert.equal(placed.rows[0]?.count,"64");assertions++;
 console.log(JSON.stringify({check:"content-structure-budgets",assertions,concurrentAdmission:true,committedDraftFixture:true}));
}finally{await client.query("rollback").catch(()=>{});client.release();await pool.end();}
